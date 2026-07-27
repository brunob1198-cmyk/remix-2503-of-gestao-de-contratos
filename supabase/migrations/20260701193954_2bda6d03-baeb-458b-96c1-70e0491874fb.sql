ALTER TABLE public.flash_category_mapping
  ADD COLUMN IF NOT EXISTS manual_confirmations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_feedback_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_feedback_source text;

UPDATE public.flash_category_mapping
SET learned = true
WHERE learned IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_flash_category_mapping_learning
ON public.flash_category_mapping (empresa_id, learned, manual_confirmations, updated_at);

COMMENT ON COLUMN public.flash_category_mapping.manual_confirmations IS 'Quantidade de confirmações manuais recebidas para este mapeamento.';
COMMENT ON COLUMN public.flash_category_mapping.learned IS 'Indica se o mapeamento já pode ser usado automaticamente nas próximas normalizações.';
COMMENT ON COLUMN public.flash_category_mapping.last_feedback_at IS 'Data da última confirmação manual usada no aprendizado.';
COMMENT ON COLUMN public.flash_category_mapping.last_feedback_source IS 'Origem da última confirmação manual do mapeamento.';