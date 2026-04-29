-- Add UPDATE policy for flash_integration_logs
CREATE POLICY "Users can update their own integration logs"
ON public.flash_integration_logs
FOR UPDATE
USING (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));

-- Also ensure INSERT is allowed for the edge function (using service role, but just in case for app-side logs if any)
-- The edge function uses service role, so it bypasses RLS, but for consistency:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'flash_integration_logs' 
        AND policyname = 'Users can insert their own integration logs'
    ) THEN
        CREATE POLICY "Users can insert their own integration logs"
        ON public.flash_integration_logs
        FOR INSERT
        WITH CHECK (empresa_id IN (SELECT profiles.empresa_id FROM profiles WHERE profiles.id = auth.uid()));
    END IF;
END $$;
