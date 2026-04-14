import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://ruhtfwfsrhyebkyqslll.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1aHRmd2Zzcmh5ZWJreXFzbGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTc3MTUsImV4cCI6MjA5MDAzMzcxNX0.l53V2C2GxEGukU96dK1lGdK38UMpfZ0DnJad3aLAJKA";

const SUPABASE_URL = import.meta.env.VITE_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_APP_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
