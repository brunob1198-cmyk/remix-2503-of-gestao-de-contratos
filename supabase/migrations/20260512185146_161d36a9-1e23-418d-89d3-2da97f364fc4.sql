-- Update bucket to be public if not already
UPDATE storage.buckets SET public = true WHERE id = 'contratos';

-- Drop existing policies to avoid conflicts and recreate them cleanly
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own contracts" ON storage.objects;

-- Recreate policies
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'contratos');

CREATE POLICY "Authenticated users can upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contratos');

CREATE POLICY "Users can update their own contracts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contratos');

CREATE POLICY "Users can delete their own contracts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contratos');