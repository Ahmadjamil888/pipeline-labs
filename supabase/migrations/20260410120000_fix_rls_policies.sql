-- =====================================================
-- FIX RLS POLICIES - Explicit UUID Casting
-- =====================================================

-- Fix profiles table RLS policies with explicit UUID casting
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid()::uuid = id);

-- Fix datasets table RLS policies with explicit UUID casting
DROP POLICY IF EXISTS "Users manage own datasets" ON public.datasets;
CREATE POLICY "Users manage own datasets" 
  ON public.datasets FOR ALL 
  TO authenticated 
  USING (auth.uid()::uuid = user_id) 
  WITH CHECK (auth.uid()::uuid = user_id);

-- Fix dataset_chats table RLS policies
DROP POLICY IF EXISTS "Users manage own chats" ON public.dataset_chats;
CREATE POLICY "Users manage own chats" 
  ON public.dataset_chats FOR ALL 
  TO authenticated 
  USING (auth.uid()::uuid = user_id) 
  WITH CHECK (auth.uid()::uuid = user_id);

-- Fix trained_models table RLS policies
DROP POLICY IF EXISTS "Users manage own models" ON public.trained_models;
CREATE POLICY "Users manage own models" 
  ON public.trained_models FOR ALL 
  TO authenticated 
  USING (auth.uid()::uuid = user_id) 
  WITH CHECK (auth.uid()::uuid = user_id);

-- Fix dataset_versions RLS policies
DROP POLICY IF EXISTS "Users can view own dataset versions" ON public.dataset_versions;
CREATE POLICY "Users can view own dataset versions" 
    ON public.dataset_versions FOR SELECT 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_versions.dataset_id 
        AND datasets.user_id = auth.uid()::uuid
    ));

DROP POLICY IF EXISTS "Users can insert own dataset versions" ON public.dataset_versions;
CREATE POLICY "Users can insert own dataset versions" 
    ON public.dataset_versions FOR INSERT 
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_versions.dataset_id 
        AND datasets.user_id = auth.uid()::uuid
    ));

-- Ensure RLS is enabled on all tables
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.datasets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_chats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trained_models FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions FORCE ROW LEVEL SECURITY;
