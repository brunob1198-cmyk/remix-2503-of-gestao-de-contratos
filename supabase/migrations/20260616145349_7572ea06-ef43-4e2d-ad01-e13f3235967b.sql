CREATE TABLE IF NOT EXISTS public.item_lpu_bdi_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_lpu_id UUID NOT NULL REFERENCES public.itens_lpu(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  bdi NUMERIC(8,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_lpu_id, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_lpu_bdi_mensal TO authenticated;
GRANT ALL ON public.item_lpu_bdi_mensal TO service_role;

ALTER TABLE public.item_lpu_bdi_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_lpu_bdi_mensal_select" ON public.item_lpu_bdi_mensal FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.itens_lpu WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id));

CREATE POLICY "item_lpu_bdi_mensal_insert" ON public.item_lpu_bdi_mensal FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.itens_lpu WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id));

CREATE POLICY "item_lpu_bdi_mensal_update" ON public.item_lpu_bdi_mensal FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.itens_lpu WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id));

CREATE POLICY "item_lpu_bdi_mensal_delete" ON public.item_lpu_bdi_mensal FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.itens_lpu WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id));

CREATE INDEX IF NOT EXISTS idx_item_lpu_bdi_mensal_item ON public.item_lpu_bdi_mensal(item_lpu_id);
CREATE INDEX IF NOT EXISTS idx_item_lpu_bdi_mensal_mes ON public.item_lpu_bdi_mensal(mes_referencia);