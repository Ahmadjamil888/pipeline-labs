import { Router, Request, Response } from 'express';
import { ExecutionEngine } from '../services/executor';
import { createConnector } from '../services/cloud/index';
import { createUserClient } from '../supabase';

export const jobsRouter = Router();

// Active execution engines (in-memory for now, could use Redis for production)
const activeEngines = new Map<string, ExecutionEngine>();

// Start a training job
jobsRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { planId, cloudProviderId } = req.body;

    if (!planId || !cloudProviderId) {
      res.status(400).json({ error: 'planId and cloudProviderId are required' });
      return;
    }

    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    // Fetch training plan
    const { data: plan, error: planError } = await client
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      res.status(404).json({ error: 'Training plan not found' });
      return;
    }

    // Fetch cloud provider
    const { data: cloudProvider, error: cpError } = await client
      .from('cloud_providers')
      .select('*')
      .eq('id', cloudProviderId)
      .eq('user_id', user.id)
      .single();

    if (cpError || !cloudProvider) {
      res.status(404).json({ error: 'Cloud provider not found' });
      return;
    }

    // Fetch dataset for storage path
    const { data: dataset, error: datasetError } = await client
      .from('datasets')
      .select('storage_path')
      .eq('id', plan.dataset_id)
      .single();

    if (datasetError || !dataset || !dataset.storage_path) {
      res.status(400).json({ error: 'Dataset or storage path not found' });
      return;
    }

    // Create training job record
    const { data: job, error: jobError } = await client
      .from('training_jobs')
      .insert({
        user_id: user.id,
        plan_id: planId,
        dataset_id: plan.dataset_id,
        cloud_provider_id: cloudProviderId,
        status: 'pending',
      })
      .select()
      .single();

    if (jobError) {
      res.status(400).json({ error: jobError.message });
      return;
    }

    // Update plan status
    await client
      .from('training_plans')
      .update({ status: 'executing' })
      .eq('id', planId);

    // Generate a signed URL for the dataset
    const { data: signedUrl, error: signedUrlError } = await client.storage
      .from('datasets')
      .createSignedUrl(dataset.storage_path, 3600);

    if (signedUrlError || !signedUrl || !signedUrl.signedUrl) {
      res.status(500).json({ error: 'Failed to create signed URL for dataset' });
      return;
    }

    const datasetUrl = signedUrl.signedUrl;

    // Start execution engine in background
    const engine = new ExecutionEngine(
      {
        cloudProvider: {
          provider: cloudProvider.provider,
          credentials: cloudProvider.credentials,
          region: cloudProvider.credentials?.region,
        },
        plan: plan.plan,
        datasetPath: datasetUrl,
        jobId: job.id,
        userId: user.id,
      },
      // Log callback - saves logs to DB
      async (logMessage: string) => {
        try {
          await client.from('training_logs').insert({
            job_id: job.id,
            level: logMessage.includes('ERROR') ? 'error' : 'info',
            message: logMessage,
          });
        } catch (e) {
          console.error('Failed to save log:', e);
        }
      },
      // Status callback - updates job status
      async (status) => {
        try {
          const statusMap: Record<string, string> = {
            provisioning: 'provisioning',
            installing: 'installing',
            uploading_data: 'running',
            training: 'running',
            saving_model: 'running',
            completed: 'completed',
            failed: 'failed',
          };

          await client
            .from('training_jobs')
            .update({
              status: statusMap[status.phase] || status.phase,
              error_message: status.phase === 'failed' ? status.message : null,
              completed_at: status.phase === 'completed' ? new Date().toISOString() : null,
            })
            .is('started_at', null)
            .eq('id', job.id);

          // Set started_at only once when transitioning from provisioning
          if (status.phase !== 'provisioning') {
            await client
              .from('training_jobs')
              .update({ started_at: new Date().toISOString() })
              .is('started_at', null)
              .eq('id', job.id);
          }

          // Save metrics during training
          if (status.currentEpoch && status.phase === 'training') {
            await client.from('training_metrics').insert({
              job_id: job.id,
              epoch: status.currentEpoch,
              step: 0,
              metric_name: 'progress',
              metric_value: (status.currentEpoch / (status.totalEpochs || 1)) * 100,
            });
          }
        } catch (e) {
          console.error('Failed to update status:', e);
        }
      }
    );

    activeEngines.set(job.id, engine);

    // Run execution asynchronously
    engine.execute().then(async (finalStatus) => {
      activeEngines.delete(job.id);

      // If completed, try to parse and save final metrics
      if (finalStatus.phase === 'completed') {
        const metricsLine = finalStatus.logs.find(l => l.includes('METRICS:'));
        if (metricsLine) {
          try {
            const metricsJson = metricsLine.split('METRICS:')[1]?.trim();
            if (metricsJson) {
              const metrics = JSON.parse(metricsJson);
              await client
                .from('training_jobs')
                .update({ final_metrics: metrics })
                .eq('id', job.id);
            }
          } catch (e) {
            console.error('Failed to parse metrics:', e);
          }
        }
      }
    }).catch(async (error) => {
      console.error('[Jobs] Execution error:', error);
      activeEngines.delete(job.id);
      
      // Update job status to failed
      await client
        .from('training_jobs')
        .update({
          status: 'failed',
          error_message: error.message || 'Execution failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    });

    res.json({ jobId: job.id, status: 'started' });
  } catch (err: any) {
    console.error('[Jobs] Start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all training jobs
jobsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data, error } = await client
      .from('training_jobs')
      .select('*, training_plans(plan, dataset_analysis, datasets(file_name)), cloud_providers(provider, label)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific job
jobsRouter.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data, error } = await client
      .from('training_jobs')
      .select('*, training_plans(plan, dataset_analysis, datasets(file_name)), cloud_providers(provider, label)')
      .eq('id', req.params.jobId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a running job
jobsRouter.post('/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const jobId = String(req.params.jobId);

    // Verify ownership first
    const { data: job, error: jobError } = await client
      .from('training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const engine = activeEngines.get(jobId);
    if (engine) {
      await engine.cancel();
      activeEngines.delete(jobId);
    }

    await client
      .from('training_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('user_id', user.id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
