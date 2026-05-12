ALTER TABLE public.custo_real_erp
  ADD COLUMN IF NOT EXISTS categoria_analise text
    CHECK (categoria_analise IN ('DIRETO','GERENCIA'))
    DEFAULT 'DIRETO',
  ADD COLUMN IF NOT EXISTS categoria_sugerida_ia text,
  ADD COLUMN IF NOT EXISTS categoria_confirmada boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_custos_erp_categoria
  ON public.custo_real_erp(projeto_id, categoria_analise, data_competencia);