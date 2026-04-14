import { Router, Request, Response } from 'express';
import { getAuth, issueApiKey } from '../auth';
import { supabaseAdmin } from '../supabase';

export const authRouter = Router();

function formatApiKeyError(error: { message?: string } | null): string {
  const message = error?.message || 'API key operation failed';
  if (message.includes("Could not find the table 'public.api_keys'")) {
    return 'API keys are not available until migration 20260413193000_api_keys_and_sdk_auth.sql is applied';
  }
  return message;
}

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, avatar_url, created_at, updated_at')
      .eq('id', auth.userId)
      .maybeSingle();

    res.json({
      userId: auth.userId,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId ?? null,
      profile: error ? null : (profile ?? null),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get('/api-keys', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, last4, scopes, created_at, last_used_at, expires_at, revoked_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: formatApiKeyError(error) });
      return;
    }

    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);

    const [profileResult, datasetsResult, providersResult, plansResult, jobsResult, apiKeysResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, avatar_url, created_at, updated_at')
        .eq('id', auth.userId)
        .maybeSingle(),
      supabaseAdmin
        .from('datasets')
        .select('id, file_name, mime_type, storage_path, row_count, column_count, status, data_type, label_column, task_type, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('cloud_providers')
        .select('id, provider, label, is_active, last_verified_at, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('training_plans')
        .select('id, dataset_id, plan, dataset_analysis, status, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('training_jobs')
        .select('id, plan_id, dataset_id, cloud_provider_id, status, instance_id, instance_type, instance_region, final_metrics, error_message, started_at, completed_at, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('api_keys')
        .select('id, name, key_prefix, last4, scopes, created_at, last_used_at, expires_at, revoked_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false }),
    ]);

    const firstError = [
      profileResult.error,
      datasetsResult.error,
      providersResult.error,
      plansResult.error,
      jobsResult.error,
      apiKeysResult.error,
    ].find(Boolean);

    if (firstError) {
      res.status(400).json({ error: formatApiKeyError(firstError) });
      return;
    }

    res.json({
      exportedAt: new Date().toISOString(),
      userId: auth.userId,
      authType: auth.authType,
      profile: profileResult.data ?? null,
      datasets: datasetsResult.data ?? [],
      cloudProviders: providersResult.data ?? [],
      trainingPlans: plansResult.data ?? [],
      trainingJobs: jobsResult.data ?? [],
      apiKeys: apiKeysResult.data ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post('/api-keys', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const { name, expiresAt, scopes } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const issued = issueApiKey();
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: auth.userId,
        name,
        key_prefix: issued.keyPrefix,
        key_hash: issued.keyHash,
        last4: issued.last4,
        scopes: Array.isArray(scopes) ? scopes : ['full_access'],
        expires_at: expiresAt || null,
      })
      .select('id, name, key_prefix, last4, scopes, created_at, last_used_at, expires_at, revoked_at')
      .single();

    if (error) {
      res.status(400).json({ error: formatApiKeyError(error) });
      return;
    }

    res.status(201).json({
      ...data,
      key: issued.plainTextKey,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.delete('/api-keys/:id', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const { error } = await supabaseAdmin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', auth.userId)
      .is('revoked_at', null);

    if (error) {
      res.status(400).json({ error: formatApiKeyError(error) });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
