ALTER TABLE public.diarios_obra ADD COLUMN IF NOT EXISTS status_ativo TEXT DEFAULT 'ON';
COMMENT ON COLUMN public.diarios_obra.status_ativo IS 'Status do ativo ao fim do acionamento (ON/OFF)';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra TO authenticated;
GRANT ALL ON public.diarios_obra TO service_role;