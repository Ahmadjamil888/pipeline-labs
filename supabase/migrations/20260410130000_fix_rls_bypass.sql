-- =====================================================
-- COMPREHENSIVE RLS FIX - Grant + Policies + RLS
-- =====================================================
-- ROOT CAUSE: Missing table-level GRANT permissions
-- Supabase security has 2 layers:
--   Layer 1: Table Permissions (GRANT) - WAS MISSING!
--   Layer 2: RLS Policies
-- Without Layer 1, Layer 2 never gets evaluated → 42501 errors
-- =====================================================

-- =====================================================
-- STEP 0: GRANT TABLE PERMISSIONS (CRITICAL!)
-- =====================================================

-- Grant all permissions on tables to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trained_models TO authenticated;
GRANT SELECT, INSERT ON public.dataset_versions TO authenticated;

-- Grant sequence usage for ID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 1: Disable RLS temporarily to diagnose
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trained_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users manage own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users manage own chats" ON public.dataset_chats;
DROP POLICY IF EXISTS "Users manage own models" ON public.trained_models;
DROP POLICY IF EXISTS "Users can view own dataset versions" ON public.dataset_versions;
DROP POLICY IF EXISTS "Users can insert own dataset versions" ON public.dataset_versions;

-- Step 3: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trained_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

-- Step 4: Create working policies using subqueries instead of direct comparison

-- Profiles policies - Allow users to see/modify their own profile
CREATE POLICY "Enable all for users based on user_id" 
  ON public.profiles 
  FOR ALL 
  TO authenticated 
  USING (id IN (SELECT auth.uid()))
  WITH CHECK (id IN (SELECT auth.uid()));

-- Datasets policies
CREATE POLICY "Enable all for users based on user_id" 
  ON public.datasets 
  FOR ALL 
  TO authenticated 
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- Dataset chats policies  
CREATE POLICY "Enable all for users based on user_id" 
  ON public.dataset_chats 
  FOR ALL 
  TO authenticated 
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- Trained models policies
CREATE POLICY "Enable all for users based on user_id" 
  ON public.trained_models 
  FOR ALL 
  TO authenticated 
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- Dataset versions policies (checks through datasets)
CREATE POLICY "Enable select for users through datasets" 
  ON public.dataset_versions 
  FOR SELECT 
  TO authenticated 
  USING (
    dataset_id IN (
      SELECT id FROM public.datasets WHERE user_id IN (SELECT auth.uid())
    )
  );

CREATE POLICY "Enable insert for users through datasets" 
  ON public.dataset_versions 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    dataset_id IN (
      SELECT id FROM public.datasets WHERE user_id IN (SELECT auth.uid())
    )
  );

-- Step 5: Force RLS for table owners too
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.datasets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_chats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trained_models FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions FORCE ROW LEVEL SECURITY;
