-- Criar tabela temporária com os IDs que queremos manter
CREATE TEMP TABLE ids_to_keep AS
SELECT DISTINCT ON (empresa_id, external_id) id
FROM public.flash_transactions_raw
ORDER BY empresa_id, external_id, transaction_date DESC NULLS LAST, created_at DESC;

-- Deletar normalizações duplicadas
DELETE FROM public.flash_normalizacao
WHERE flash_transaction_id NOT IN (SELECT id FROM ids_to_keep);

-- Deletar registros brutos duplicados
DELETE FROM public.flash_transactions_raw
WHERE id NOT IN (SELECT id FROM ids_to_keep);

-- Limpar tabela temporária
DROP TABLE ids_to_keep;

-- Ajustar constraints
ALTER TABLE public.flash_transactions_raw 
DROP CONSTRAINT IF EXISTS flash_transactions_raw_deterministic_unique;

ALTER TABLE public.flash_transactions_raw
ADD CONSTRAINT flash_transactions_raw_empresa_external_unique 
UNIQUE (empresa_id, external_id);
