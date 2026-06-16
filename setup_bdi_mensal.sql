-- 1. Adicionar flag de BDI variável na tabela de projetos
ALTER TABLE projetos
  ADD COLUMN IF NOT EXISTS bdi_variavel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bdi_padrao   NUMERIC(5, 4);

COMMENT ON COLUMN projetos.bdi_variavel IS
  'Se TRUE, o BDI deste projeto é lido mensalmente de projeto_bdi_mensal.
   Se FALSE, usa o bdi fixo de cada item da itens_lpu.';

COMMENT ON COLUMN projetos.bdi_padrao IS
  'BDI padrão usado quando bdi_variavel=TRUE mas não há registro para
   o mês solicitado (evita retornar null).';

-- 2. Criar tabela de calendário de BDI mensal
CREATE TABLE IF NOT EXISTS projeto_bdi_mensal (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id  UUID      NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  competencia DATE      NOT NULL,  -- sempre o dia 1 do mês: 2026-01-01, 2026-02-01...
  bdi         NUMERIC(5, 4) NOT NULL CHECK (bdi > 0 AND bdi < 10),
  observacao  TEXT,
  criado_por  UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_projeto_bdi_mes UNIQUE (projeto_id, competencia)
);

COMMENT ON COLUMN projeto_bdi_mensal.competencia IS
  'Primeiro dia do mês de competência (ex: 2026-06-01 = junho/2026).
   Sempre normalizar para o dia 1 antes de inserir.';

-- Índice para as queries de leitura (projeto + mês)
CREATE INDEX IF NOT EXISTS idx_pbdi_projeto_mes
  ON projeto_bdi_mensal (projeto_id, competencia DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pbdi_updated_at ON projeto_bdi_mensal;
CREATE TRIGGER trg_pbdi_updated_at
  BEFORE UPDATE ON projeto_bdi_mensal
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 3. RLS
ALTER TABLE projeto_bdi_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pbdi_select" ON projeto_bdi_mensal
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pbdi_insert" ON projeto_bdi_mensal
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "pbdi_update" ON projeto_bdi_mensal
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "pbdi_delete" ON projeto_bdi_mensal
  FOR DELETE TO authenticated USING (true);

-- 4. Função de resolução de BDI
--    Usada pela análise de custos para obter o BDI correto
--    por projeto e mês de competência.
CREATE OR REPLACE FUNCTION fn_get_bdi(
  p_projeto_id UUID,
  p_competencia DATE          -- passar sempre o 1º dia do mês
)
RETURNS NUMERIC AS $$
DECLARE
  v_variavel  BOOLEAN;
  v_padrao    NUMERIC;
  v_bdi       NUMERIC;
BEGIN
  -- Verifica se o projeto usa BDI variável
  SELECT bdi_variavel, bdi_padrao
  INTO   v_variavel, v_padrao
  FROM   projetos
  WHERE  id = p_projeto_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT v_variavel THEN
    RETURN NULL; -- sinal para o consumidor usar item.bdi (fixo)
  END IF;

  -- Busca BDI do mês exato
  SELECT bdi INTO v_bdi
  FROM   projeto_bdi_mensal
  WHERE  projeto_id  = p_projeto_id
    AND  competencia = date_trunc('month', p_competencia)::DATE;

  -- Fallback: bdi_padrao do projeto
  RETURN COALESCE(v_bdi, v_padrao);
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. View de apoio: BDI efetivo por projeto e mês
--    Útil para exibir o histórico completo na tela de LPU
--    e para debug da análise de custos.
CREATE OR REPLACE VIEW vw_bdi_efetivo AS
SELECT
  p.id                     AS projeto_id,
  p.codigo                 AS projeto_codigo,
  p.nome                   AS projeto_nome,
  p.bdi_variavel,
  p.bdi_padrao,
  m.competencia,
  m.bdi                    AS bdi_mensal,
  m.observacao,
  COALESCE(m.bdi, p.bdi_padrao) AS bdi_efetivo
FROM projetos p
LEFT JOIN projeto_bdi_mensal m ON m.projeto_id = p.id
WHERE p.bdi_variavel = TRUE
ORDER BY p.codigo, m.competencia DESC;
