-- ============================================================
-- SUPPLY CHAIN — Pedidos e Avaliações de Fornecedor
-- Supabase SQL + RLS
-- Ordem de execução: rodar tudo de uma vez no SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUM: status do pedido
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE pedido_status AS ENUM (
    'rascunho',
    'emitido',
    'confirmado',
    'entrega_parcial',
    'entregue',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------
-- AJUSTE: Adicionar coluna 'score' na tabela fornecedores existente
-- ------------------------------------------------------------
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) DEFAULT 0;

-- ------------------------------------------------------------
-- 2. TABELA: pedidos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT NOT NULL UNIQUE, -- ex: PED-0001
  cotacao_id            UUID NOT NULL REFERENCES cotacoes(id) ON DELETE RESTRICT,
  requisicao_id         UUID NOT NULL REFERENCES requisicoes_compra(id) ON DELETE RESTRICT,
  fornecedor_id         UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  projeto_id            UUID REFERENCES projetos(id) ON DELETE SET NULL,
  empresa_id            UUID NOT NULL, -- Importante para multi-tenant / RLS

  -- valores confirmados da cotação vencedora
  valor_total           NUMERIC(14, 2) NOT NULL,
  frete                 NUMERIC(14, 2) DEFAULT 0,
  condicao_pagamento    TEXT,
  prazo_entrega_dias    INTEGER,

  -- controle de datas
  data_emissao          DATE,
  data_prevista_entrega DATE,
  data_entrega_real     DATE,

  -- nota fiscal
  nf_numero             TEXT,
  nf_serie              TEXT,
  nf_arquivo_url        TEXT,
  nf_emitida_em         TIMESTAMPTZ,

  -- status e observações
  status                pedido_status NOT NULL DEFAULT 'rascunho',
  observacoes           TEXT,
  motivo_cancelamento   TEXT,

  -- rastreabilidade
  criado_por            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. TABELA: pedido_itens
--    Itens do pedido copiados da cotação vencedora
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id             UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_id               UUID REFERENCES sc_itens(id) ON DELETE SET NULL, -- alterado para referenciar sc_itens
  cotacao_item_id       UUID REFERENCES cotacao_itens(id) ON DELETE SET NULL,

  descricao             TEXT NOT NULL, -- snapshot da descrição no momento do pedido
  unidade               TEXT NOT NULL,
  quantidade_pedida     NUMERIC(14, 4) NOT NULL,
  quantidade_recebida   NUMERIC(14, 4) NOT NULL DEFAULT 0,
  valor_unitario        NUMERIC(14, 4) NOT NULL,
  valor_total           NUMERIC(14, 2) GENERATED ALWAYS AS (quantidade_pedida * valor_unitario) STORED,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. TABELA: pedido_recebimentos
--    Registra recebimentos parciais ou totais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_recebimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id             UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,

  data_recebimento      DATE NOT NULL DEFAULT CURRENT_DATE,
  recebido_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_recebimento_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id        UUID NOT NULL REFERENCES pedido_recebimentos(id) ON DELETE CASCADE,
  pedido_item_id        UUID NOT NULL REFERENCES pedido_itens(id) ON DELETE CASCADE,
  quantidade_recebida   NUMERIC(14, 4) NOT NULL
);

-- ------------------------------------------------------------
-- 5. TABELA: avaliacoes_fornecedor
--    Preenchida ao encerrar o pedido — alimenta o score
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes_fornecedor (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id             UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  fornecedor_id         UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,

  -- notas de 1 a 5
  nota_prazo            SMALLINT NOT NULL CHECK (nota_prazo BETWEEN 1 AND 5),
  nota_qualidade        SMALLINT NOT NULL CHECK (nota_qualidade BETWEEN 1 AND 5),
  nota_preco            SMALLINT NOT NULL CHECK (nota_preco BETWEEN 1 AND 5),
  nota_responsividade   SMALLINT CHECK (nota_responsividade BETWEEN 1 AND 5),

  -- dias prometidos vs entregues (calculado pelo sistema)
  dias_prometidos       INTEGER,
  dias_entregues        INTEGER,
  atraso_dias           INTEGER GENERATED ALWAYS AS (
                          GREATEST(0, dias_entregues - dias_prometidos)
                        ) STORED,

  observacao            TEXT,
  avaliado_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 6. FUNÇÃO: calcular score do fornecedor
--    Pesos: prazo 40%, preço 30%, qualidade 20%, responsividade 10%
--    Score final: 0 a 100
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_score_fornecedor(p_fornecedor_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  SELECT
    ROUND(
      AVG(
        (nota_prazo        * 0.40 +
         nota_preco        * 0.30 +
         nota_qualidade    * 0.20 +
         COALESCE(nota_responsividade, nota_prazo) * 0.10)
        * 20  -- converte escala 1-5 para 0-100
      ), 1
    )
  INTO v_score
  FROM avaliacoes_fornecedor
  WHERE fornecedor_id = p_fornecedor_id;

  RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------
-- 7. TRIGGER: atualiza score no fornecedor após avaliação
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_atualiza_score_fornecedor()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fornecedores
  SET
    score      = calcular_score_fornecedor(NEW.fornecedor_id),
    updated_at = now()
  WHERE id = NEW.fornecedor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_score_fornecedor ON avaliacoes_fornecedor;
CREATE TRIGGER trg_score_fornecedor
  AFTER INSERT OR UPDATE ON avaliacoes_fornecedor
  FOR EACH ROW EXECUTE FUNCTION trigger_atualiza_score_fornecedor();

-- ------------------------------------------------------------
-- 8. TRIGGER: atualiza updated_at automaticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedidos_updated_at ON pedidos;
CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- 9. TRIGGER: ao encerrar pedido, atualiza preco_referencia do item
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_atualiza_preco_referencia()
RETURNS TRIGGER AS $$
BEGIN
  -- só executa quando status muda para 'entregue'
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') THEN
    UPDATE sc_itens i
    SET
      preco_referencia = pi.valor_unitario,
      atualizado_em    = now()
    FROM pedido_itens pi
    WHERE pi.pedido_id = NEW.id
      AND pi.item_id   = i.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preco_referencia ON pedidos;
CREATE TRIGGER trg_preco_referencia
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_atualiza_preco_referencia();

-- ------------------------------------------------------------
-- 10. TRIGGER: ao criar pedido, muda status da requisição
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_requisicao_pedido_emitido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'emitido' AND (OLD.status IS DISTINCT FROM 'emitido') THEN
    UPDATE requisicoes_compra
    SET
      workflow_status = 'PURCHASED',
      updated_at = now()
    WHERE id = NEW.requisicao_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requisicao_pedido ON pedidos;
CREATE TRIGGER trg_requisicao_pedido
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION trigger_requisicao_pedido_emitido();

-- ------------------------------------------------------------
-- 11. TRIGGER: acumula quantidade recebida nos pedido_itens
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_acumula_recebimento()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pedido_itens
  SET quantidade_recebida = (
    SELECT COALESCE(SUM(pri.quantidade_recebida), 0)
    FROM pedido_recebimento_itens pri
    WHERE pri.pedido_item_id = NEW.pedido_item_id
  )
  WHERE id = NEW.pedido_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acumula_recebimento ON pedido_recebimento_itens;
CREATE TRIGGER trg_acumula_recebimento
  AFTER INSERT ON pedido_recebimento_itens
  FOR EACH ROW EXECUTE FUNCTION trigger_acumula_recebimento();

-- ------------------------------------------------------------
-- 12. ÍNDICES para performance
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pedidos_fornecedor    ON pedidos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_requisicao    ON pedidos(requisicao_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status        ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_projeto       ON pedidos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido   ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_fornecedor ON avaliacoes_fornecedor(fornecedor_id);

-- ------------------------------------------------------------
-- 13. RLS — Row Level Security
-- ------------------------------------------------------------
ALTER TABLE pedidos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_recebimentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_recebimento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_fornecedor    ENABLE ROW LEVEL SECURITY;

-- PEDIDOS
CREATE POLICY "pedidos_select" ON pedidos
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "pedidos_insert" ON pedidos
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() AND empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "pedidos_update" ON pedidos
  FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "pedidos_delete" ON pedidos
  FOR DELETE TO authenticated
  USING (status = 'rascunho' AND criado_por = auth.uid() AND empresa_id IN (SELECT empresa_id FROM profiles WHERE id = auth.uid()));

-- PEDIDO ITENS
CREATE POLICY "pedido_itens_select" ON pedido_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pedido_itens_insert" ON pedido_itens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pedido_itens_update" ON pedido_itens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "pedido_itens_delete" ON pedido_itens
  FOR DELETE TO authenticated USING (true);

-- RECEBIMENTOS
CREATE POLICY "recebimentos_select" ON pedido_recebimentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recebimentos_insert" ON pedido_recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (recebido_por = auth.uid());

CREATE POLICY "recebimentos_itens_select" ON pedido_recebimento_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recebimentos_itens_insert" ON pedido_recebimento_itens
  FOR INSERT TO authenticated WITH CHECK (true);

-- AVALIAÇÕES
CREATE POLICY "avaliacoes_select" ON avaliacoes_fornecedor
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "avaliacoes_insert" ON avaliacoes_fornecedor
  FOR INSERT TO authenticated
  WITH CHECK (avaliado_por = auth.uid());

CREATE POLICY "avaliacoes_update" ON avaliacoes_fornecedor
  FOR UPDATE TO authenticated
  USING (avaliado_por = auth.uid())
  WITH CHECK (avaliado_por = auth.uid());

-- ------------------------------------------------------------
-- 14. VIEW: resumo de pedidos (útil para listagem e dashboard)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_pedidos_resumo AS
SELECT
  p.id,
  p.numero,
  p.status,
  p.valor_total,
  p.data_emissao,
  p.data_prevista_entrega,
  p.data_entrega_real,
  p.empresa_id,
  f.razao_social                          AS fornecedor_nome,
  f.score                                 AS fornecedor_score,
  r.numero                                AS requisicao_numero,
  r.projeto_id,
  p.criado_por,
  p.created_at,
  CASE
    WHEN p.data_entrega_real IS NOT NULL THEN
      (p.data_entrega_real - p.data_prevista_entrega)
    ELSE
      (CURRENT_DATE - p.data_prevista_entrega)
  END                                     AS atraso_dias
FROM pedidos p
JOIN fornecedores  f ON f.id = p.fornecedor_id
JOIN requisicoes_compra   r ON r.id = p.requisicao_id;
