ALTER TABLE public.diario_fotos ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_diario_fotos_diario_ordem ON public.diario_fotos (diario_id, ordem);