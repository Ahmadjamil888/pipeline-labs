import { createClient } from "@supabase/supabase-js";

// Make sure process.env works in Vite if necessary, or just use what they asked
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL! || import.meta.env?.VITE_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
);
