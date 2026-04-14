import { Router, Request, Response } from 'express';
import { createConnector } from '../services/cloud/index';
import { getAuth } from '../auth';
import { supabaseAdmin } from '../supabase';
import { encryptCredentials, maskCredentials, unwrapStoredCredentials } from '../services/cloud/credentials';

export const cloudRouter = Router();

// List user's cloud providers
cloudRouter.get('/providers', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);

    const { data, error } = await supabaseAdmin
      .from('cloud_providers')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Decrypt and mask credentials before sending to frontend
    const masked = data.map(p => {
      let creds: Record<string, string> = {};
      try {
        creds = unwrapStoredCredentials(p.credentials);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
      }
      return {
        ...p,
        credentials: maskCredentials(creds),
      };
    });

    res.json(masked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a cloud provider
cloudRouter.post('/providers', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);

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

    const { encrypted, nonce } = encryptCredentials(credentials);
    const { data, error } = await supabaseAdmin
      .from('cloud_providers')
      .insert({
        user_id: auth.userId,
        provider,
        label: label || `My ${provider.toUpperCase()}`,
        credentials: { encrypted, nonce },
        last_verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    let decryptedCreds: Record<string, string> = {};
    try {
      decryptedCreds = unwrapStoredCredentials(data.credentials);
    } catch (e) {
      console.error('Failed to decrypt credentials:', e);
    }
    res.json({
      ...data,
      credentials: maskCredentials(decryptedCreds),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a cloud provider
cloudRouter.patch('/providers/:id', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);

    const { label, credentials, is_active } = req.body;
    const updates: Record<string, unknown> = {};
    if (label) updates.label = label;
    if (credentials) {
      const { encrypted, nonce } = encryptCredentials(credentials);
      updates.credentials = { encrypted, nonce };
    }
    if (is_active !== undefined) updates.is_active = is_active;

    // Fetch existing record first to check ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('cloud_providers')
      .select('*, credentials')
      .eq('id', req.params.id)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Cloud provider not found' });
      return;
    }

    // Re-validate if credentials changed
    if (credentials) {
      let decryptedCreds: Record<string, string> = {};
      try {
        decryptedCreds = unwrapStoredCredentials(existing.credentials);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
      }
      const region = decryptedCreds.region || credentials.region;
      const connector = createConnector({ provider: existing.provider, credentials, region });
      const isValid = await connector.validate();
      if (!isValid) {
        res.status(400).json({ error: 'Invalid credentials' });
        return;
      }
      updates.last_verified_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('cloud_providers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', auth.userId)
      .select()
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    let decryptedCreds: Record<string, string> = {};
    try {
      decryptedCreds = unwrapStoredCredentials(data.credentials);
    } catch (e) {
      console.error('Failed to decrypt credentials:', e);
    }
    res.json({
      ...data,
      credentials: maskCredentials(decryptedCreds),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a cloud provider
cloudRouter.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);

    const { error } = await supabaseAdmin
      .from('cloud_providers')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', auth.userId);

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
    const auth = getAuth(req);
    const { providerId, gpuType, estimatedHours } = req.body;

    if (!providerId || !gpuType) {
      res.status(400).json({ error: 'providerId and gpuType are required' });
      return;
    }

    const { data: provider, error } = await supabaseAdmin
      .from('cloud_providers')
      .select('*')
      .eq('id', providerId)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (error || !provider) {
      res.status(404).json({ error: 'Cloud provider not found' });
      return;
    }

    let decryptedCreds: Record<string, string> = {};
    try {
      decryptedCreds = unwrapStoredCredentials(provider.credentials);
    } catch (e) {
      console.error('Failed to decrypt credentials:', e);
      res.status(500).json({ error: 'Failed to decrypt credentials' });
      return;
    }
    const connector = createConnector({
      provider: provider.provider,
      credentials: decryptedCreds,
      region: decryptedCreds?.region,
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
