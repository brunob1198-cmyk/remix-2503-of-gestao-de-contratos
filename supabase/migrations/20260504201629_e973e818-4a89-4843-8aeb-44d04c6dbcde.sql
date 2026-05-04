-- Adicionar a coluna contrato_ids como um array de UUIDs
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS contrato_ids UUID[] DEFAULT '{}';

-- Migrar dados existentes de contrato_id para o array contrato_ids
UPDATE public.projetos 
SET contrato_ids = ARRAY[contrato_id] 
WHERE contrato_id IS NOT NULL AND (contrato_ids IS NULL OR cardinality(contrato_ids) = 0);

-- Criar um índice para melhor performance de busca por contrato em projetos
CREATE INDEX IF NOT EXISTS idx_projetos_contrato_ids ON public.projetos USING GIN(contrato_ids);
