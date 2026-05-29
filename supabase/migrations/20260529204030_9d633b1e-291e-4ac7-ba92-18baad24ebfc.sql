-- Adicionar coluna de forecast nos projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS forecast_data JSONB DEFAULT '{}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.projetos.forecast_data IS 'Armazena previsões de execução mensal no formato {"YYYY-MM": valor}';
