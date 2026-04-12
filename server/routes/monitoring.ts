import { Router, Request, Response } from 'express';
import { createUserClient } from '../supabase';

export const monitoringRouter = Router();

// Get logs for a training job
monitoringRouter.get('/:jobId/logs', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }
    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      res.status(401).json({ error: 'Missing access token' });
      return;
    }
    const client = createUserClient(accessToken);

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await client
      .from('training_logs')
      .select('*')
      .eq('job_id', req.params.jobId)
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get metrics for a training job (for loss/accuracy graphs)
monitoringRouter.get('/:jobId/metrics', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }
    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      res.status(401).json({ error: 'Missing access token' });
      return;
    }
    const client = createUserClient(accessToken);

    // Pagination support
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 1000, 10000); // Max 10000
    const page = Math.max(parseInt(req.query.page as string) || 0, 0);
    const offset = page * pageSize;

    const { data, error } = await client
      .from('training_metrics')
      .select('*')
      .eq('job_id', req.params.jobId)
      .order('timestamp', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Group metrics by name for charting
    const grouped: Record<string, { epoch: number; step: number; value: number; timestamp: string }[]> = {};
    for (const m of data || []) {
      if (!grouped[m.metric_name]) grouped[m.metric_name] = [];
      grouped[m.metric_name].push({
        epoch: m.epoch,
        step: m.step,
        value: m.metric_value,
        timestamp: m.timestamp,
      });
    }

    res.json(grouped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get job status summary
monitoringRouter.get('/:jobId/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }
    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      res.status(401).json({ error: 'Missing access token' });
      return;
    }
    const client = createUserClient(accessToken);

    const { data: job, error } = await client
      .from('training_jobs')
      .select('id, status, started_at, completed_at, error_message, final_metrics, instance_type, instance_region')
      .eq('id', req.params.jobId)
      .single();

    if (error || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Get latest logs
    const { data: recentLogs } = await client
      .from('training_logs')
      .select('timestamp, level, message')
      .eq('job_id', req.params.jobId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Get latest metrics
    const { data: latestMetrics } = await client
      .from('training_metrics')
      .select('metric_name, metric_value, epoch, step')
      .eq('job_id', req.params.jobId)
      .order('timestamp', { ascending: false })
      .limit(20);

    res.json({
      ...job,
      recentLogs: recentLogs || [],
      latestMetrics: latestMetrics || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
