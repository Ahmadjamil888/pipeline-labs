CREATE TABLE public.dataset_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dataset_id)
);

ALTER TABLE public.dataset_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chats" ON public.dataset_chats
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.trained_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  model_name text NOT NULL,
  algorithm text NOT NULL,
  status text DEFAULT 'pending',
  accuracy double precision,
  logs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.trained_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own models" ON public.trained_models
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);