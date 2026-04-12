import { Router, Request, Response } from 'express';
import { createConnector } from '../services/cloud/index';
import { supabaseAdmin, createUserClient } from '../supabase';

export const cloudRouter = Router();

// List user's cloud providers
cloudRouter.get('/providers', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data, error } = await client
      .from('cloud_providers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Mask credentials before sending to frontend
    const masked = data.map(p => ({
      ...p,
      credentials: maskCredentials(p.provider, p.credentials),
    }));

    res.json(masked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a cloud provider
cloudRouter.post('/providers', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { provider, label, credentials } = req.body;

    if (!provider || !credentials) {
      res.status(400).json({ error: 'provider and credentials are required' });
      return;
    }

    // Validate credentials by testing connection
    const connector = createConnector({ provider, credentials, region: credentials.region });
    const isValid = await connector.validate();

    if (!isValid) {
      res.status(400).json({ error: 'Invalid cloud credentials. Please verify your keys.' });
      return;
    }

    const { data, error } = await client
      .from('cloud_providers')
      .insert({
        user_id: user.id,
        provider,
        label: label || `My ${provider.toUpperCase()}`,
        credentials,
        last_verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      ...data,
      credentials: maskCredentials(data.provider, data.credentials),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a cloud provider
cloudRouter.patch('/providers/:id', async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { label, credentials, is_active } = req.body;
    const updates: Record<string, unknown> = {};
    if (label) updates.label = label;
    if (credentials) updates.credentials = credentials;
    if (is_active !== undefined) updates.is_active = is_active;

    // Re-validate if credentials changed
    if (credentials) {
      const { data: existing } = await client
        .from('cloud_providers')
        .select('provider')
        .eq('id', req.params.id)
        .single();

      if (existing) {
        const connector = createConnector({ provider: existing.provider, credentials });
        const isValid = await connector.validate();
        if (!isValid) {
          res.status(400).json({ error: 'Invalid credentials' });
          return;
        }
        updates.last_verified_at = new Date().toISOString();
      }
    }

    const { data, error } = await client
      .from('cloud_providers')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      ...data,
      credentials: maskCredentials(data.provider, data.credentials),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a cloud provider
cloudRouter.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { error } = await client
      .from('cloud_providers')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get estimated cost for a training run
cloudRouter.post('/estimate-cost', async (req: Request, res: Response) => {
  try {
    const { providerId, gpuType, estimatedHours } = req.body;

    if (!providerId || !gpuType) {
      res.status(400).json({ error: 'providerId and gpuType are required' });
      return;
    }

    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { data: provider, error } = await client
      .from('cloud_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (error || !provider) {
      res.status(404).json({ error: 'Cloud provider not found' });
      return;
    }

    const connector = createConnector({
      provider: provider.provider,
      credentials: provider.credentials,
      region: provider.credentials?.region,
    });

    const cost = await connector.getEstimatedCost(gpuType, estimatedHours || 1);

    res.json({
      provider: provider.provider,
      gpuType,
      estimatedHours: estimatedHours || 1,
      estimatedCostUsd: cost,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// Helper: Mask credentials for frontend display
// =====================================================
function maskCredentials(provider: string, creds: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(creds)) {
    if (typeof value !== 'string') {
      masked[key] = value;
      continue;
    }
    if (value.length <= 4) {
      masked[key] = '****';
    } else {
      masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
    }
  }
  return masked;
}
