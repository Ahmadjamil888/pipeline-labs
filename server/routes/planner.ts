import { Router, Request, Response } from 'express';
import { analyzeDataset, generateTrainingPlan, aiEnhancedPlan } from '../services/planner';
import { supabaseAdmin, createUserClient } from '../supabase';

export const plannerRouter = Router();

// Analyze a dataset and generate a training plan
plannerRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { datasetId, userObjective } = req.body;

    if (!datasetId) {
      res.status(400).json({ error: 'datasetId is required' });
      return;
    }

    // Fetch dataset from Supabase
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data: dataset, error: dsError } = await client
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (dsError || !dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }

    // Download dataset from storage
    const { data: storageData, error: storageError } = await client.storage
      .from('datasets')
      .download(dataset.storage_path);

    if (storageError || !storageData) {
      res.status(500).json({ error: 'Failed to download dataset' });
      return;
    }

    const text = await storageData.text();
    const isJSON = dataset.storage_path?.endsWith('.json');
    let data: Record<string, unknown>[];

    if (isJSON) {
      data = JSON.parse(text);
      if (!Array.isArray(data)) data = [data];
    } else {
      // Simple CSV parse
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const v = values[i] || '';
          const num = Number(v);
          row[h] = !isNaN(num) && v !== '' ? num : v;
        });
        return row;
      });
    }

    // Step A: Analyze dataset
    const analysis = analyzeDataset(data);

    // Step B: Generate training plan (AI-enhanced if possible)
    const geminiKey = process.env.GEMINI_API_KEY;
    const plan = await aiEnhancedPlan(analysis, data.slice(0, 10), userObjective, geminiKey);

    // Save to database
    const { data: planRecord, error: planError } = await client
      .from('training_plans')
      .insert({
        user_id: user.id,
        dataset_id: datasetId,
        plan,
        dataset_analysis: analysis,
        status: 'draft',
      })
      .select()
      .single();

    if (planError) {
      console.error('Failed to save plan:', planError);
      // Still return the plan even if save fails
    }

    // Update dataset with detected info
    await client
      .from('datasets')
      .update({
        data_type: analysis.data_type,
        label_column: analysis.label_column,
        task_type: analysis.task_type,
      })
      .eq('id', datasetId);

    res.json({
      analysis,
      plan,
      planId: planRecord?.id,
    });
  } catch (err: any) {
    console.error('[Planner] Error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// Get an existing training plan
plannerRouter.get('/:planId', async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data, error } = await client
      .from('training_plans')
      .select('*')
      .eq('id', req.params.planId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a training plan (user modifies before approving)
plannerRouter.patch('/:planId', async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { plan, status } = req.body;

    const updates: Record<string, unknown> = {};
    if (plan) updates.plan = plan;
    if (status) updates.status = status;

    const { data, error } = await client
      .from('training_plans')
      .update(updates)
      .eq('id', req.params.planId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all training plans for user
plannerRouter.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data, error } = await client
      .from('training_plans')
      .select('*, datasets(file_name, row_count, column_count)')
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
