-- Remove a restrição antiga que impedia múltiplos mapeamentos para o mesmo tipo de transação
ALTER TABLE public.flash_category_mapping 
DROP CONSTRAINT IF EXISTS flash_category_mapping_empresa_id_flash_type_key;

-- Adiciona a nova restrição de unicidade composta que suporta granularidade
-- O PostgreSQL trata NULL como valores distintos em restrições UNIQUE, 
-- então para garantir que (empresa_id, flash_type, NULL, NULL) seja único,
-- usamos uma restrição COALESCE ou simplesmente garantimos que não haja duplicatas lógicas.
-- Para maior compatibilidade com o frontend que envia strings vazias ou "-", vamos manter a restrição simples:
ALTER TABLE public.flash_category_mapping 
ADD CONSTRAINT flash_category_mapping_granular_key 
UNIQUE (empresa_id, flash_type, flash_category, flash_cost_center);