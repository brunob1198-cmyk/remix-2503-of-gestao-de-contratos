-- Adiciona campos para rastrear motivo da normalização e snapshot do payload
ALTER TABLE public.flash_normalizacao
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS flash_type_detectado text,
  ADD COLUMN IF NOT EXISTS mapping_id_usado uuid,
  ADD COLUMN IF NOT EXISTS conta_azul_payload jsonb;

COMMENT ON COLUMN public.flash_normalizacao.motivo IS 'Motivo detalhado da normalização (ex: "Mapeamento aplicado automaticamente", "Pendente: tipo não mapeado")';
COMMENT ON COLUMN public.flash_normalizacao.flash_type_detectado IS 'flash_type extraído da transação no momento da normalização';
COMMENT ON COLUMN public.flash_normalizacao.mapping_id_usado IS 'ID do mapeamento (flash_category_mapping) usado para preencher categoria/conta';
COMMENT ON COLUMN public.flash_normalizacao.conta_azul_payload IS 'Snapshot do payload exato que será enviado ao Conta Azul';