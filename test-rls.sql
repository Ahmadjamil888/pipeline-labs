-- EMERGENCY FIX: Test if RLS is the issue
-- Run this in Supabase SQL Editor

-- Option 1: Temporarily disable RLS to test (UNSAFE - only for debugging)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.datasets DISABLE ROW LEVEL SECURITY;

-- Option 2: Add a permissive test policy (SAFER)
-- This allows any authenticated user to read all data
-- Run this, test your app, then remove it

DROP POLICY IF EXISTS "TEMP DEBUG Allow all authenticated" ON public.profiles;
CREATE POLICY "TEMP DEBUG Allow all authenticated" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "TEMP DEBUG Allow all datasets" ON public.datasets;
CREATE POLICY "TEMP DEBUG Allow all datasets" 
    ON public.datasets FOR SELECT 
    TO authenticated
    USING (true);

-- After testing, run this to remove temp policies and restore proper RLS:
-- DROP POLICY IF EXISTS "TEMP DEBUG Allow all authenticated" ON public.profiles;
-- DROP POLICY IF EXISTS "TEMP DEBUG Allow all datasets" ON public.datasets;
-- CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
-- CREATE POLICY "Users can view own datasets" ON public.datasets FOR SELECT TO authenticated USING (auth.uid() = user_id);

SELECT 'Temp policies created - test your app now' as result;
