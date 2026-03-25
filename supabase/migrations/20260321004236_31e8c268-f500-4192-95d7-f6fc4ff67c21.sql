
-- Add BDI column to itens_lpu
ALTER TABLE public.itens_lpu ADD COLUMN bdi numeric NOT NULL DEFAULT 1.0;

-- Add item_lpu_id to escopo_itens for linking to LPU items
ALTER TABLE public.escopo_itens ADD COLUMN item_lpu_id uuid REFERENCES public.itens_lpu(id);

-- Add fields to lancamentos_medicao for enhanced approval flow
ALTER TABLE public.lancamentos_medicao ADD COLUMN periodo_inicio date;
ALTER TABLE public.lancamentos_medicao ADD COLUMN periodo_fim date;
ALTER TABLE public.lancamentos_medicao ADD COLUMN data_resposta timestamp with time zone;
ALTER TABLE public.lancamentos_medicao ADD COLUMN quantidade_aprovada numeric DEFAULT 0;
ALTER TABLE public.lancamentos_medicao ADD COLUMN quantidade_rejeitada numeric DEFAULT 0;
