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

ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS preview_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS objective text;

DROP TRIGGER IF EXISTS update_datasets_updated_at ON public.datasets;
CREATE TRIGGER update_datasets_updated_at
BEFORE UPDATE ON public.datasets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('datasets', 'datasets', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Users can view their own dataset files" ON storage.objects;
CREATE POLICY "Users can view their own dataset files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'datasets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload their own dataset files" ON storage.objects;
CREATE POLICY "Users can upload their own dataset files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'datasets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their own dataset files" ON storage.objects;
CREATE POLICY "Users can update their own dataset files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'datasets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'datasets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own dataset files" ON storage.objects;
CREATE POLICY "Users can delete their own dataset files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'datasets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);