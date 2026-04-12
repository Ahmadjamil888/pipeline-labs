import { Router, Request, Response } from 'express';
import { createConnector } from '../services/cloud/index';
import { supabaseAdmin, createUserClient } from '../supabase';
import crypto from 'crypto';

export const cloudRouter = Router();

// =====================================================
// Encryption helpers for credentials
// =====================================================
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function encryptCredentials(credentials: Record<string, string>): { encrypted: string; nonce: string } {
  const nonce = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), nonce);
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted + authTag.toString('hex'),
    nonce: nonce.toString('hex'),
  };
}

function decryptCredentials(encrypted: string, nonce: string): Record<string, string> {
  const authTagLength = 16;
  const authTag = Buffer.from(encrypted.slice(-authTagLength * 2), 'hex');
  const ciphertext = encrypted.slice(0, -authTagLength * 2);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(nonce, 'hex'));
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

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

    // Decrypt and mask credentials before sending to frontend
    const masked = data.map(p => {
      let creds: Record<string, string> = {};
      if (p.credentials && typeof p.credentials === 'object' && 'encrypted' in p.credentials) {
        try {
          creds = decryptCredentials(p.credentials.encrypted as string, p.credentials.nonce as string);
        } catch (e) {
          console.error('Failed to decrypt credentials:', e);
        }
      } else {
        creds = p.credentials as Record<string, string>;
      }
      return {
        ...p,
        credentials: maskCredentials(p.provider, creds),
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

    const { encrypted, nonce } = encryptCredentials(credentials);
    const { data, error } = await client
      .from('cloud_providers')
      .insert({
        user_id: user.id,
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
    if (data.credentials && typeof data.credentials === 'object' && 'encrypted' in data.credentials) {
      try {
        decryptedCreds = decryptCredentials(data.credentials.encrypted as string, data.credentials.nonce as string);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
      }
    } else {
      decryptedCreds = data.credentials as Record<string, string>;
    }
    res.json({
      ...data,
      credentials: maskCredentials(data.provider, decryptedCreds),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a cloud provider
cloudRouter.patch('/providers/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { label, credentials, is_active } = req.body;
    const updates: Record<string, unknown> = {};
    if (label) updates.label = label;
    if (credentials) {
      const { encrypted, nonce } = encryptCredentials(credentials);
      updates.credentials = { encrypted, nonce };
    }
    if (is_active !== undefined) updates.is_active = is_active;

    // Fetch existing record first to check ownership
    const { data: existing, error: fetchError } = await client
      .from('cloud_providers')
      .select('*, credentials')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Cloud provider not found' });
      return;
    }

    // Re-validate if credentials changed
    if (credentials) {
      let decryptedCreds: Record<string, string> = {};
      if (existing.credentials && typeof existing.credentials === 'object' && 'encrypted' in existing.credentials) {
        try {
          decryptedCreds = decryptCredentials(existing.credentials.encrypted as string, existing.credentials.nonce as string);
        } catch (e) {
          console.error('Failed to decrypt credentials:', e);
        }
      } else {
        decryptedCreds = existing.credentials as Record<string, string>;
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

    const { data, error } = await client
      .from('cloud_providers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    let decryptedCreds: Record<string, string> = {};
    if (data.credentials && typeof data.credentials === 'object' && 'encrypted' in data.credentials) {
      try {
        decryptedCreds = decryptCredentials(data.credentials.encrypted as string, data.credentials.nonce as string);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
      }
    } else {
      decryptedCreds = data.credentials as Record<string, string>;
    }
    res.json({
      ...data,
      credentials: maskCredentials(data.provider, decryptedCreds),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a cloud provider
cloudRouter.delete('/providers/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const accessToken = req.headers.authorization?.split(' ')[1] || '';
    const client = createUserClient(accessToken);

    const { error } = await client
      .from('cloud_providers')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

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

    let decryptedCreds: Record<string, string> = {};
    if (provider.credentials && typeof provider.credentials === 'object' && 'encrypted' in provider.credentials) {
      try {
        decryptedCreds = decryptCredentials(provider.credentials.encrypted as string, provider.credentials.nonce as string);
      } catch (e) {
        console.error('Failed to decrypt credentials:', e);
        res.status(500).json({ error: 'Failed to decrypt credentials' });
        return;
      }
    } else {
      decryptedCreds = provider.credentials as Record<string, string>;
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
