
-- Create the storage bucket for diário de campo photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('diario-fotos', 'diario-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for diario-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'diario-fotos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to diario-fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'diario-fotos');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete from diario-fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'diario-fotos');
