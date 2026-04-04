-- DIAGNOSTIC: Run this in Supabase SQL Editor to check current RLS status

-- 1. Check if RLS is enabled
SELECT 
    schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profiles', 'datasets', 'dataset_chats', 'trained_models');

-- 2. Check existing policies
SELECT 
    schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 3. Quick fix - run these if you see no policies:

-- Enable RLS on datasets
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Users can view own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can insert own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can update own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can delete own datasets" ON public.datasets;

CREATE POLICY "Users can view own datasets" 
    ON public.datasets FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own datasets" 
    ON public.datasets FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own datasets" 
    ON public.datasets FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own datasets" 
    ON public.datasets FOR DELETE 
    TO authenticated
    USING (auth.uid() = user_id);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

SELECT 'RLS policies updated' as result;
