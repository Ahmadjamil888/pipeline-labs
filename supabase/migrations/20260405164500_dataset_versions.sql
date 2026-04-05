-- =====================================================
-- DATASET_VERSIONS TABLE (For Undo and History)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.dataset_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dataset_id UUID REFERENCES public.datasets ON DELETE CASCADE NOT NULL,
    version_data JSONB NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own dataset versions" ON public.dataset_versions;
DROP POLICY IF EXISTS "Users can insert own dataset versions" ON public.dataset_versions;

CREATE POLICY "Users can view own dataset versions" 
    ON public.dataset_versions FOR SELECT 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_versions.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own dataset versions" 
    ON public.dataset_versions FOR INSERT 
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.datasets 
        WHERE datasets.id = dataset_versions.dataset_id 
        AND datasets.user_id = auth.uid()
    ));

CREATE INDEX IF NOT EXISTS dataset_versions_dataset_id_idx ON public.dataset_versions(dataset_id);
CREATE INDEX IF NOT EXISTS dataset_versions_created_at_idx ON public.dataset_versions(created_at DESC);
