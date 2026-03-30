-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for the 'contratos' bucket
-- Allow authenticated users to upload files to 'contratos'
CREATE POLICY "Allow authenticated users to upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contratos');

-- Allow authenticated users to select files from 'contratos'
CREATE POLICY "Allow authenticated users to read contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contratos');

-- Allow authenticated users to delete their own files from 'contratos' (optional, but good for cleanup)
CREATE POLICY "Allow authenticated users to delete contracts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contratos');
