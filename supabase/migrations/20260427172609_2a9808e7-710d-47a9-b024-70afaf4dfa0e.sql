-- Adicionar colunas para mapeamento mais granulado
ALTER TABLE public.flash_category_mapping 
ADD COLUMN IF NOT EXISTS flash_category TEXT,
ADD COLUMN IF NOT EXISTS flash_cost_center TEXT,
ADD COLUMN IF NOT EXISTS flash_description_pattern TEXT;

-- Adicionar índice para melhorar a busca por esses campos
CREATE INDEX IF NOT EXISTS idx_flash_category_mapping_granularity 
ON public.flash_category_mapping (flash_type, flash_category, flash_cost_center);

-- Comentários explicativos
COMMENT ON COLUMN public.flash_category_mapping.flash_category IS 'Subcategoria específica do Flash para este mapeamento';
COMMENT ON COLUMN public.flash_category_mapping.flash_cost_center IS 'Centro de custo específico do Flash para este mapeamento';
COMMENT ON COLUMN public.flash_category_mapping.flash_description_pattern IS 'Padrão ou palavra-chave na descrição para matching inteligente';
