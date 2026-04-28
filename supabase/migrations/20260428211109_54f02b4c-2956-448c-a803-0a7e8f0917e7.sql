-- Add protocol column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flash_integration_logs' AND column_name='conta_azul_protocolo') THEN
        ALTER TABLE public.flash_integration_logs ADD COLUMN conta_azul_protocolo TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flash_integration_logs' AND column_name='reconciliado') THEN
        ALTER TABLE public.flash_integration_logs ADD COLUMN reconciliado BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flash_integration_logs' AND column_name='reconciliado_at') THEN
        ALTER TABLE public.flash_integration_logs ADD COLUMN reconciliado_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Ensure RLS is enabled and user can see their logs
ALTER TABLE public.flash_integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integration logs" 
ON public.flash_integration_logs 
FOR SELECT 
USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
