import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from './supabase';

type AuthType = 'jwt' | 'api_key' | 'dev';

export interface AuthContext {
  userId: string;
  authType: AuthType;
  email?: string | null;
  apiKeyId?: string;
}

interface ApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last4: string;
  scopes: string[] | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const API_KEY_PREFIX = 'plk_live_';
let cachedDevAuth: AuthContext | null = null;

function getAnonKey(): string {
  const value = process.env.SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
  }
  return value;
}

function getSupabaseUrl(): string {
  const value = process.env.SUPABASE_URL;
  if (!value) {
    throw new Error('SUPABASE_URL environment variable is required');
  }
  return value;
}

function hashApiKeySecret(secret: string, salt?: string): string {
  const effectiveSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, effectiveSalt, 64).toString('hex');
  return `${effectiveSalt}:${hash}`;
}

function verifyApiKeySecret(secret: string, encodedHash: string): boolean {
  const [salt, expectedHash] = encodedHash.split(':');
  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(secret, salt, 64).toString('hex');
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

async function resolveDevAuth(req: Request): Promise<AuthContext> {
  const explicitUserId =
    String(req.headers['x-dev-user-id'] || '').trim() ||
    String(process.env.DEV_USER_ID || '').trim();

  if (explicitUserId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', explicitUserId)
      .maybeSingle();

    const auth = {
      userId: explicitUserId,
      authType: 'dev',
      email: profile?.email ?? null,
    };
    cachedDevAuth = auth;
    return auth;
  }

  if (cachedDevAuth) {
    return cachedDevAuth;
  }

  const { data: firstProfile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!error && firstProfile) {
    const auth = {
      userId: firstProfile.id,
      authType: 'dev',
      email: firstProfile.email ?? null,
    };
    cachedDevAuth = auth;
    return auth;
  }

  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  const fallbackUser = users?.users?.[0];
  if (usersError || !fallbackUser?.id) {
    throw new Error(
      'Development auth bypass is enabled but no DEV_USER_ID was provided and no user exists to impersonate'
    );
  }

  const auth = {
    userId: fallbackUser.id,
    authType: 'dev',
    email: fallbackUser.email ?? null,
  };
  cachedDevAuth = auth;
  return auth;
}

async function resolveJwtAuth(token: string): Promise<AuthContext | null> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: getAnonKey(),
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json() as { id?: string; email?: string | null };
  if (!user.id) {
    return null;
  }

  return {
    userId: user.id,
    authType: 'jwt',
    email: user.email ?? null,
  };
}

function extractApiKey(rawValue: string): string | null {
  const value = rawValue.trim();
  return value.startsWith(API_KEY_PREFIX) ? value : null;
}

async function resolveApiKeyAuth(rawKey: string): Promise<AuthContext | null> {
  const apiKey = extractApiKey(rawKey);
  if (!apiKey) {
    return null;
  }

  const keyPrefix = apiKey.slice(0, API_KEY_PREFIX.length + 8);
  const { data: record, error } = await supabaseAdmin
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)
    .maybeSingle<ApiKeyRecord>();

  if (error || !record) {
    return null;
  }

  if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
    return null;
  }

  if (!verifyApiKeySecret(apiKey, record.key_hash)) {
    return null;
  }

  void supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', record.id);

  return {
    userId: record.user_id,
    authType: 'api_key',
    apiKeyId: record.id,
  };
}

async function resolveAuth(req: Request): Promise<AuthContext | null> {
  if (process.env.DISABLE_AUTH === 'true') {
    return resolveDevAuth(req);
  }

  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return resolveApiKeyAuth(xApiKey);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return null;
    }

    if (token.startsWith(API_KEY_PREFIX)) {
      return resolveApiKeyAuth(token);
    }

    return resolveJwtAuth(token);
  }

  if (authHeader.startsWith('ApiKey ')) {
    return resolveApiKeyAuth(authHeader.slice('ApiKey '.length).trim());
  }

  return null;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = await resolveAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    (req as Request & { auth?: AuthContext }).auth = auth;
    next();
  } catch (error) {
    console.error('[Auth] Failed to resolve request auth:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function getAuth(req: Request): AuthContext {
  const auth = (req as Request & { auth?: AuthContext }).auth;
  if (!auth) {
    throw new Error('Missing auth context on request');
  }
  return auth;
}

export function issueApiKey(): {
  plainTextKey: string;
  keyPrefix: string;
  keyHash: string;
  last4: string;
} {
  const secret = crypto.randomBytes(24).toString('hex');
  const plainTextKey = `${API_KEY_PREFIX}${secret}`;

  return {
    plainTextKey,
    keyPrefix: plainTextKey.slice(0, API_KEY_PREFIX.length + 8),
    keyHash: hashApiKeySecret(plainTextKey),
    last4: plainTextKey.slice(-4),
  };
}
