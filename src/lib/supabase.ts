import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ruhtfwfsrhyebkyqslll.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1aHRmd2Zzcmh5ZWJreXFzbGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTc3MTUsImV4cCI6MjA5MDAzMzcxNX0.l53V2C2GxEGukU96dK1lGdK38UMpfZ0DnJad3aLAJKA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
