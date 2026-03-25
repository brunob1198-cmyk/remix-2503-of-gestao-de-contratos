-- Remove unique constraint on codigo to allow same code in different projects
ALTER TABLE public.itens_lpu DROP CONSTRAINT itens_lpu_codigo_key;

-- Add composite unique index (codigo + projeto_id) instead
-- This allows same codigo with different projeto_id (or null for general)
CREATE UNIQUE INDEX idx_itens_lpu_codigo_projeto ON public.itens_lpu (codigo, COALESCE(projeto_id, '00000000-0000-0000-0000-000000000000'::uuid));