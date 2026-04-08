
-- Add capa_url column to lancamentos_medicao
ALTER TABLE public.lancamentos_medicao
ADD COLUMN capa_url TEXT DEFAULT NULL;

-- Create storage bucket for cover pages
INSERT INTO storage.buckets (id, name, public)
VALUES ('medicao-capas', 'medicao-capas', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload cover pages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medicao-capas');

-- Allow public read
CREATE POLICY "Cover pages are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'medicao-capas');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete cover pages"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'medicao-capas');
