-- Add logo_empresa_url column to lancamentos_medicao
ALTER TABLE public.lancamentos_medicao 
ADD COLUMN IF NOT EXISTS logo_empresa_url TEXT;

COMMENT ON COLUMN public.lancamentos_medicao.logo_empresa_url IS 'URL da logo da empresa fixada no momento da geração da medição';
