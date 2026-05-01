-- Create storage bucket for measurement PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medicoes-pdf', 'medicoes-pdf', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for medicoes-pdf bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'medicoes-pdf');

CREATE POLICY "Allow Service Role Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'medicoes-pdf');

CREATE POLICY "Allow Service Role Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'medicoes-pdf');
