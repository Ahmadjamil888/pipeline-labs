-- =====================================================
-- PIPELINE LABS - COMPLETE DATABASE SETUP SCRIPT
-- Run this in a fresh Supabase project's SQL Editor
-- =====================================================

-- =====================================================
-- 0. CREATE SCHEMA (if not exists)
-- =====================================================
CREATE SCHEMA IF NOT EXISTS public;

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. STORAGE BUCKETS (Run in Storage section or use Supabase Dashboard)
-- =====================================================
-- Note: Buckets must be created via API or Dashboard
-- Create these buckets in Supabase Dashboard > Storage:
--   - datasets (public: false)
--   - avatars (public: true)

-- =====================================================
-- 3. PROFILES TABLE (User profiles)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 4. DATASETS TABLE (Main data storage)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    row_count INTEGER DEFAULT 0,
    column_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'uploaded',
    preview_rows JSONB,
    column_analysis JSONB,
    objective TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for datasets
DROP POLICY IF EXISTS "Users can view own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can create own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can update own datasets" ON public.datasets;
DROP POLICY IF EXISTS "Users can delete own datasets" ON public.datasets;

CREATE POLICY "Users can view own datasets" 
    ON public.datasets FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own datasets" 
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

-- Index for faster queries
CREATE INDEX IF NOT EXISTS datasets_user_id_idx ON public.datasets(user_id);
CREATE INDEX IF NOT EXISTS datasets_created_at_idx ON public.datasets(created_at DESC);

-- =====================================================
-- 5. DATASET_CHATS TABLE (AI chat history)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.dataset_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dataset_id UUID REFERENCES public.datasets ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(dataset_id)
);

-- Enable RLS
ALTER TABLE public.dataset_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies - using subquery to check dataset ownership
DROP POLICY IF EXISTS "Users can view own dataset chats" ON public.dataset_chats;
DROP POLICY IF EXISTS "Users can insert own dataset chats" ON public.dataset_chats;
DROP POLICY IF EXISTS "Users can update own dataset chats" ON public.dataset_chats;
DROP POLICY IF EXISTS "Users can delete own dataset chats" ON public.dataset_chats;

CREATE POLICY "Users can view own dataset chats" 
    ON public.dataset_chats FOR SELECT 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_chats.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own dataset chats" 
    ON public.dataset_chats FOR INSERT 
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_chats.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own dataset chats" 
    ON public.dataset_chats FOR UPDATE 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_chats.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own dataset chats" 
    ON public.dataset_chats FOR DELETE 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_chats.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE INDEX IF NOT EXISTS dataset_chats_user_id_idx ON public.dataset_chats(user_id);
CREATE INDEX IF NOT EXISTS dataset_chats_dataset_id_idx ON public.dataset_chats(dataset_id);

-- =====================================================
-- 6. TRAINED_MODELS TABLE (Model training history)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trained_models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    dataset_id UUID REFERENCES public.datasets ON DELETE CASCADE NOT NULL,
    model_name TEXT NOT NULL,
    algorithm TEXT,
    accuracy DECIMAL(5,4),
    training_logs TEXT[],
    status TEXT DEFAULT 'training',
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trained_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own trained models" ON public.trained_models;
DROP POLICY IF EXISTS "Users can insert own trained models" ON public.trained_models;
DROP POLICY IF EXISTS "Users can update own trained models" ON public.trained_models;
DROP POLICY IF EXISTS "Users can delete own trained models" ON public.trained_models;

CREATE POLICY "Users can view own trained models" 
    ON public.trained_models FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trained models" 
    ON public.trained_models FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trained models" 
    ON public.trained_models FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trained models" 
    ON public.trained_models FOR DELETE 
    TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trained_models_user_id_idx ON public.trained_models(user_id);
CREATE INDEX IF NOT EXISTS trained_models_dataset_id_idx ON public.trained_models(dataset_id);

-- =====================================================
-- 7. AUTH PROVIDER CONFIGURATION (Manual - Dashboard only)
-- =====================================================
-- NOTE: auth.providers cannot be configured via SQL for security reasons.
-- You MUST configure Google OAuth in Supabase Dashboard:
--
-- 1. Go to Supabase Dashboard > Authentication > Providers
-- 2. Click on "Google"
-- 3. Toggle "Enabled" to ON
-- 4. Enter your Google Client ID
-- 5. Enter your Google Client Secret
-- 6. Save
--
-- Get Google credentials from: https://console.cloud.google.com
-- Redirect URI: https://pipelinelabs-ashen.vercel.app/auth

-- =====================================================
-- 8. UPDATE TRIGGERS (Auto-update updated_at)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_datasets_updated_at ON public.datasets;
CREATE TRIGGER handle_datasets_updated_at
    BEFORE UPDATE ON public.datasets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_dataset_chats_updated_at ON public.dataset_chats;
CREATE TRIGGER handle_dataset_chats_updated_at
    BEFORE UPDATE ON public.dataset_chats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_trained_models_updated_at ON public.trained_models;
CREATE TRIGGER handle_trained_models_updated_at
    BEFORE UPDATE ON public.trained_models
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 9. STORAGE POLICIES (RLS for Storage buckets)
-- =====================================================

-- Policies for 'datasets' bucket
DROP POLICY IF EXISTS "Users can upload own datasets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own datasets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own datasets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can upload own datasets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'datasets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own datasets"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'datasets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own datasets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'datasets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policies for 'avatars' bucket (public read)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- 10. VERIFICATION QUERIES (Run these to verify setup)
-- =====================================================

-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check auth providers (run in Dashboard: Auth > Providers)
-- SELECT provider, enabled FROM auth.providers;

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- 
-- NEXT STEPS:
-- 1. Create Storage Buckets in Dashboard:
--    - datasets (private)
--    - avatars (public)
-- 
-- 2. Configure Google OAuth:
--    - Go to Authentication > Providers > Google
--    - Enable Google provider
--    - Add your Google Client ID and Secret
--    - Set redirect URL: https://your-app.com/auth
-- 
-- 3. Update your .env file with new Supabase credentials
-- 
-- 4. Deploy your app!
--
