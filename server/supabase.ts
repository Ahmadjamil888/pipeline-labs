import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ensureEnvLoaded } from './env';

ensureEnvLoaded();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required for admin operations');
}

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create a user-scoped client for RLS-respecting operations
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
