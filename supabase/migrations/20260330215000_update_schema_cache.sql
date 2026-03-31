-- Script para garantir que a coluna contrato_id exista e forçar a atualização do cache do schema

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projetos' AND column_name='contrato_id') THEN
        ALTER TABLE public.projetos ADD COLUMN contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projetos' AND column_name='valor_total') THEN
        ALTER TABLE public.projetos ADD COLUMN valor_total NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Força o PostgREST (API do Supabase) a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
