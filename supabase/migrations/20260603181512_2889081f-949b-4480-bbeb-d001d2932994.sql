ALTER TABLE public.diarios_obra ADD COLUMN IF NOT EXISTS status_ativo TEXT;
COMMENT ON COLUMN public.diarios_obra.status_ativo IS 'Status do ativo ao fim do acionamento (On/Off)';

-- Os GRANTs já devem existir, mas é boa prática reafirmar para novas colunas se necessário, 
-- embora em tabelas existentes o acesso costume ser herdado.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra TO authenticated;
GRANT ALL ON public.diarios_obra TO service_role;
