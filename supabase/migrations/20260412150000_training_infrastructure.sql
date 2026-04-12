-- =====================================================
-- TRAINING INFRASTRUCTURE - Cloud Providers, Training Jobs, Logs, Metrics
-- =====================================================
-- This migration adds the full ML training pipeline to Pipeline Labs.
-- Users store their own cloud API keys (encrypted at rest via RLS).
-- AI generates training plans; the system executes them via safe API adapters.
-- =====================================================

-- =====================================================
-- 1. CLOUD_PROVIDERS - User's cloud credentials
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cloud_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp', 'runpod')),
  label TEXT NOT NULL DEFAULT 'My Cloud',
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- AWS: { access_key_id, secret_access_key, region }
  -- Azure: { subscription_id, tenant_id, client_id, client_secret, resource_group, region }
  -- GCP: { project_id, service_account_key (base64), region }
  -- RunPod: { api_key }
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, label)
);

ALTER TABLE public.cloud_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cloud providers"
  ON public.cloud_providers FOR ALL
  TO authenticated
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- =====================================================
-- 2. TRAINING_PLANS - AI-generated training plans
-- =====================================================
CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example plan structure:
  -- {
  --   "task": "text_classification",
  --   "model": "distilbert-base-uncased",
  --   "train_test_split": "80/20",
  --   "batch_size": 16,
  --   "optimizer": "adamw",
  --   "epochs": 3,
  --   "gpu_required": "T4",
  --   "estimated_time_minutes": 45,
  --   "estimated_cost_usd": 0.50,
  --   "preprocessing": ["tokenize", "pad_sequences"],
  --   "metrics": ["accuracy", "f1_score", "loss"]
  -- }
  dataset_analysis JSONB DEFAULT '{}'::jsonb,
  -- { data_type: "tabular", label_column: "sentiment", task_type: "classification", ... }
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'executing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own training plans"
  ON public.training_plans FOR ALL
  TO authenticated
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- =====================================================
-- 3. TRAINING_JOBS - Actual execution records
-- =====================================================
CREATE TABLE IF NOT EXISTS public.training_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  cloud_provider_id UUID REFERENCES public.cloud_providers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'installing', 'running', 'completed', 'failed', 'cancelled')),
  -- Remote instance info
  instance_id TEXT,
  instance_type TEXT,
  instance_ip TEXT,
  instance_region TEXT,
  -- Training results
  final_metrics JSONB DEFAULT '{}'::jsonb,
  -- { accuracy: 0.92, f1: 0.89, loss: 0.15, ... }
  model_artifact_path TEXT,
  -- Storage path for the trained model
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own training jobs"
  ON public.training_jobs FOR ALL
  TO authenticated
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- =====================================================
-- 4. TRAINING_LOGS - Streaming logs from training
-- =====================================================
CREATE TABLE IF NOT EXISTS public.training_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.training_jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  level TEXT DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own training logs"
  ON public.training_logs FOR ALL
  TO authenticated
  USING (job_id IN (SELECT id FROM public.training_jobs WHERE user_id IN (SELECT auth.uid())))
  WITH CHECK (job_id IN (SELECT id FROM public.training_jobs WHERE user_id IN (SELECT auth.uid())));

-- =====================================================
-- 5. TRAINING_METRICS - Time-series metrics (loss, accuracy, GPU usage)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.training_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.training_jobs(id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL DEFAULT 0,
  step INTEGER NOT NULL DEFAULT 0,
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.training_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own training metrics"
  ON public.training_metrics FOR ALL
  TO authenticated
  USING (job_id IN (SELECT id FROM public.training_jobs WHERE user_id IN (SELECT auth.uid())))
  WITH CHECK (job_id IN (SELECT id FROM public.training_jobs WHERE user_id IN (SELECT auth.uid())));

-- =====================================================
-- 6. MODEL_ARTIFACTS - Trained model storage references
-- =====================================================
CREATE TABLE IF NOT EXISTS public.model_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.training_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  framework TEXT DEFAULT 'pytorch',
  -- pytorch, tensorflow, sklearn, etc.
  model_config JSONB DEFAULT '{}'::jsonb,
  -- Model architecture config, hyperparams used, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.model_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own model artifacts"
  ON public.model_artifacts FOR ALL
  TO authenticated
  USING (user_id IN (SELECT auth.uid()))
  WITH CHECK (user_id IN (SELECT auth.uid()));

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS training_plans_user_id_idx ON public.training_plans(user_id);
CREATE INDEX IF NOT EXISTS training_plans_dataset_id_idx ON public.training_plans(dataset_id);
CREATE INDEX IF NOT EXISTS training_plans_status_idx ON public.training_plans(status);

CREATE INDEX IF NOT EXISTS training_jobs_user_id_idx ON public.training_jobs(user_id);
CREATE INDEX IF NOT EXISTS training_jobs_plan_id_idx ON public.training_jobs(plan_id);
CREATE INDEX IF NOT EXISTS training_jobs_status_idx ON public.training_jobs(status);
CREATE INDEX IF NOT EXISTS training_jobs_created_at_idx ON public.training_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS training_logs_job_id_idx ON public.training_logs(job_id);
CREATE INDEX IF NOT EXISTS training_logs_timestamp_idx ON public.training_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS training_metrics_job_id_idx ON public.training_metrics(job_id);
CREATE INDEX IF NOT EXISTS training_metrics_job_epoch_idx ON public.training_metrics(job_id, epoch);

CREATE INDEX IF NOT EXISTS model_artifacts_user_id_idx ON public.model_artifacts(user_id);
CREATE INDEX IF NOT EXISTS model_artifacts_job_id_idx ON public.model_artifacts(job_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_artifacts TO authenticated;

-- =====================================================
-- FORCE RLS
-- =====================================================
ALTER TABLE public.cloud_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.training_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.model_artifacts FORCE ROW LEVEL SECURITY;

-- =====================================================
-- UPDATE datasets table to support data_type detection
-- =====================================================
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'tabular'
  CHECK (data_type IN ('tabular', 'text', 'image', 'audio', 'mixed'));
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS label_column TEXT;
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS task_type TEXT
  CHECK (task_type IS NULL OR task_type IN ('classification', 'regression', 'text_classification', 'ner', 'llm_finetuning', 'image_classification', 'object_detection', 'clustering', 'anomaly_detection'));

-- =====================================================
-- TRIGGER for updated_at on new tables
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cloud_providers_updated_at ON public.cloud_providers;
CREATE TRIGGER update_cloud_providers_updated_at
BEFORE UPDATE ON public.cloud_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_plans_updated_at ON public.training_plans;
CREATE TRIGGER update_training_plans_updated_at
BEFORE UPDATE ON public.training_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_jobs_updated_at ON public.training_jobs;
CREATE TRIGGER update_training_jobs_updated_at
BEFORE UPDATE ON public.training_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET for model artifacts
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Users can view own model files" ON storage.objects;
CREATE POLICY "Users can view own model files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'models'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload own model files" ON storage.objects;
CREATE POLICY "Users can upload own model files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'models'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own model files" ON storage.objects;
CREATE POLICY "Users can delete own model files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'models'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
