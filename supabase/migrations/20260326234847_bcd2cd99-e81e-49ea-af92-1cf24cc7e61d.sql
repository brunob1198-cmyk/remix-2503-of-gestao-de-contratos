
-- Create storage bucket for timeline evidence photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('timeline-evidencias', 'timeline-evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload timeline-evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'timeline-evidencias');

-- Allow public read
CREATE POLICY "Public read timeline-evidencias"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'timeline-evidencias');

-- Allow authenticated delete
CREATE POLICY "Authenticated delete timeline-evidencias"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'timeline-evidencias');

-- Add validated column to timeline_eventos
ALTER TABLE public.timeline_eventos
ADD COLUMN IF NOT EXISTS geo_validado boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS geo_metodo text DEFAULT 'exif',
ADD COLUMN IF NOT EXISTS geo_confianca text DEFAULT 'high',
ADD COLUMN IF NOT EXISTS geo_descricao text;
