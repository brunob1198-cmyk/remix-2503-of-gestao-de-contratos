
-- 1. Limpeza da versão anterior (BDI por Projeto)
DROP TABLE IF EXISTS projeto_bdi_mensal CASCADE;

ALTER TABLE projetos 
  DROP COLUMN IF EXISTS bdi_variavel,
  DROP COLUMN IF EXISTS bdi_padrao;

-- 2. Criação da nova tabela (BDI por Item da LPU)
CREATE TABLE IF NOT EXISTS item_lpu_bdi_mensal (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  item_lpu_id     UUID      NOT NULL REFERENCES itens_lpu(id) ON DELETE CASCADE,
  mes_referencia  VARCHAR(7) NOT NULL, -- Ex: '2026-04'
  bdi             NUMERIC(5, 4) NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_lpu_id, mes_referencia)
);

COMMENT ON TABLE item_lpu_bdi_mensal IS 'Armazena o BDI mensal de cada item da LPU.';

-- 3. Configuração do RLS (Row Level Security)
ALTER TABLE item_lpu_bdi_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_lpu_bdi_mensal_select" ON item_lpu_bdi_mensal;

CREATE POLICY "item_lpu_bdi_mensal_select" 
ON item_lpu_bdi_mensal FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM itens_lpu
    WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id
  )
);

DROP POLICY IF EXISTS "item_lpu_bdi_mensal_insert" ON item_lpu_bdi_mensal;

CREATE POLICY "item_lpu_bdi_mensal_insert" 
ON item_lpu_bdi_mensal FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM itens_lpu
    WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id
  )
);

DROP POLICY IF EXISTS "item_lpu_bdi_mensal_update" ON item_lpu_bdi_mensal;

CREATE POLICY "item_lpu_bdi_mensal_update" 
ON item_lpu_bdi_mensal FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM itens_lpu
    WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id
  )
);

DROP POLICY IF EXISTS "item_lpu_bdi_mensal_delete" ON item_lpu_bdi_mensal;

CREATE POLICY "item_lpu_bdi_mensal_delete" 
ON item_lpu_bdi_mensal FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM itens_lpu
    WHERE itens_lpu.id = item_lpu_bdi_mensal.item_lpu_id
  )
);
