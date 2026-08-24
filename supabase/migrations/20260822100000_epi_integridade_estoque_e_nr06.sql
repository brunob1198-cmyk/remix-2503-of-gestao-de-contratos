-- Migration: integridade do estoque de EPI e itens da NR-06
--
-- O modulo de EPI controlava estoque com leitura-e-escrita no CLIENTE: o hook lia
-- `estoque_atual`, subtraia a quantidade e gravava o resultado. Isso produz quatro
-- problemas, e os quatro sao corrigidos aqui movendo a regra para o banco.
--
--   1. CONCORRENCIA. Duas entregas ao mesmo tempo leem o mesmo estoque e a segunda
--      sobrescreve a primeira. O estoque fica MAIOR que o real, e a tela passa a
--      autorizar entrega de equipamento que nao existe.
--
--   2. REMOCAO NAO RECOMPOE. A entrega decrementava; apagar o registro nao
--      devolvia nada. Lancar uma entrega por engano e apaga-la deixava o estoque
--      permanentemente menor.
--
--   3. DEVOLUCAO SEM LIMITE. Nada impedia devolver 10 unidades de uma entrega de
--      2. Em condicao "BOM" isso reincorporava 10 ao estoque — estoque inventado a
--      partir de erro de digitacao.
--
--   4. REGRA SO NO CLIENTE. O bloqueio de CA vencido (NR-06 6.2) e o de estoque
--      insuficiente existiam apenas no hook. Qualquer outro caminho de escrita
--      furava os dois.
--
-- Alem disso, dois itens da NR-06 que o modulo nao registrava:
--
--   - 6.6.1 "d": orientar e treinar o trabalhador sobre o uso, a guarda e a
--     conservacao. Nao havia onde registrar que isso foi feito.
--   - Vida util do equipamento: sem ela nao ha como dizer que um capacete
--     entregue ha tres anos precisa ser trocado.

-- =====================================================================
-- 1. Campos novos
-- =====================================================================

ALTER TABLE public.sgsst_epis
  -- Vida util em meses, contada da entrega. Diferente da validade do CA: o CA e
  -- do modelo (vence para todo mundo na mesma data), a vida util e da unidade
  -- entregue aquele trabalhador.
  ADD COLUMN IF NOT EXISTS vida_util_meses integer;

COMMENT ON COLUMN public.sgsst_epis.vida_util_meses IS
  'Vida util em meses, contada da data de entrega. Nao confundir com validade_ca: o CA e do modelo e vence para todos na mesma data; a vida util e da unidade que o trabalhador recebeu.';

COMMENT ON COLUMN public.sgsst_epis.ca IS
  'Numero do Certificado de Aprovacao. A NR-06 6.2 proibe fornecer EPI sem CA — por isso NOT NULL e nao vazio.';

-- CA em branco passava pelo NOT NULL. EPI sem CA nao e EPI para a norma.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sgsst_epi_ca_nao_vazio'
  ) THEN
    ALTER TABLE public.sgsst_epis
      ADD CONSTRAINT chk_sgsst_epi_ca_nao_vazio CHECK (btrim(ca) <> '');
  END IF;
END $$;

ALTER TABLE public.sgsst_epi_entregas
  -- NR-06 6.6.1 "d". Fica na ENTREGA e nao no colaborador: a orientacao e sobre
  -- aquele equipamento, e trocar de tipo de EPI exige orientar de novo.
  ADD COLUMN IF NOT EXISTS orientacao_uso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orientacao_observacao text;

COMMENT ON COLUMN public.sgsst_epi_entregas.orientacao_uso IS
  'Trabalhador orientado quanto ao uso, guarda e conservacao deste equipamento (NR-06 6.6.1 alinea "d").';

-- =====================================================================
-- 2. Validacao da entrega — CA vencido e estoque
-- =====================================================================
-- O que era checagem de tela vira garantia de banco. A tela continua dando a
-- mensagem amigavel antes; o banco impede o que escapar dela.
CREATE OR REPLACE FUNCTION public.check_sgsst_epi_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epi record;
BEGIN
  SELECT nome, ca, validade_ca, estoque_atual, status
    INTO v_epi
    FROM public.sgsst_epis
   WHERE id = NEW.epi_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EPI informado não existe no catálogo.';
  END IF;

  IF NEW.quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade entregue deve ser maior que zero.';
  END IF;

  -- NR-06 6.2: so se fornece EPI com CA valido. A comparacao e com a DATA DA
  -- ENTREGA, nao com hoje: lancamento retroativo de uma entrega que era regular
  -- na epoca nao pode ser recusado agora.
  IF v_epi.validade_ca IS NOT NULL AND v_epi.validade_ca < NEW.data_entrega THEN
    RAISE EXCEPTION 'O CA % do EPI "%" estava vencido em % (validade %). A NR-06 proíbe fornecer EPI sem CA válido.',
      v_epi.ca, v_epi.nome, NEW.data_entrega, v_epi.validade_ca;
  END IF;

  IF v_epi.status <> 'ATIVO' THEN
    RAISE EXCEPTION 'O EPI "%" está inativo no catálogo e não pode ser entregue.', v_epi.nome;
  END IF;

  IF v_epi.estoque_atual < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente do EPI "%": disponível %, solicitado %.',
      v_epi.nome, v_epi.estoque_atual, NEW.quantidade;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_entrega_valida ON public.sgsst_epi_entregas;
CREATE TRIGGER trg_sgsst_epi_entrega_valida
  BEFORE INSERT ON public.sgsst_epi_entregas
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_epi_entrega();

-- =====================================================================
-- 3. Devolucao nao pode exceder o saldo da entrega
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_sgsst_epi_devolucao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entregue integer;
  v_ja_devolvido integer;
BEGIN
  IF NEW.quantidade_devolvida <= 0 THEN
    RAISE EXCEPTION 'A quantidade devolvida deve ser maior que zero.';
  END IF;

  SELECT quantidade INTO v_entregue
    FROM public.sgsst_epi_entregas
   WHERE id = NEW.entrega_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega de origem não encontrada.';
  END IF;

  SELECT COALESCE(SUM(quantidade_devolvida), 0) INTO v_ja_devolvido
    FROM public.sgsst_epi_devolucoes
   WHERE entrega_id = NEW.entrega_id
     -- No UPDATE, a propria linha nao conta duas vezes.
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_ja_devolvido + NEW.quantidade_devolvida > v_entregue THEN
    RAISE EXCEPTION 'Devolução maior que o saldo: entregues %, já devolvidos %, tentando devolver %.',
      v_entregue, v_ja_devolvido, NEW.quantidade_devolvida;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_devolucao_valida ON public.sgsst_epi_devolucoes;
CREATE TRIGGER trg_sgsst_epi_devolucao_valida
  BEFORE INSERT OR UPDATE ON public.sgsst_epi_devolucoes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_epi_devolucao();

-- =====================================================================
-- 4. Movimentacao de estoque, no banco
-- =====================================================================
-- O UPDATE aqui e relativo (`estoque_atual - X`), nao absoluto. E essa diferenca
-- que elimina a corrida: o banco resolve a aritmetica com a linha travada, e duas
-- entregas simultaneas somam em vez de uma sobrescrever a outra.
CREATE OR REPLACE FUNCTION public.fn_sgsst_epi_estoque_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sgsst_epis
       SET estoque_atual = GREATEST(0, estoque_atual - NEW.quantidade),
           updated_at = now()
     WHERE id = NEW.epi_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Apagar a entrega recompoe o estoque. Sem isto, corrigir um lancamento
    -- errado custava estoque para sempre.
    UPDATE public.sgsst_epis
       SET estoque_atual = estoque_atual + OLD.quantidade,
           updated_at = now()
     WHERE id = OLD.epi_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_estoque_entrega ON public.sgsst_epi_entregas;
CREATE TRIGGER trg_sgsst_epi_estoque_entrega
  AFTER INSERT OR DELETE ON public.sgsst_epi_entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_epi_estoque_entrega();

-- Devolucao so reincorpora o que volta em BOM estado. Danificado, inutilizado ou
-- vencido nao pode voltar a ser entregue a ninguem.
CREATE OR REPLACE FUNCTION public.fn_sgsst_epi_estoque_devolucao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epi_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.condicao_epi <> 'BOM' THEN
      RETURN NULL;
    END IF;

    SELECT epi_id INTO v_epi_id FROM public.sgsst_epi_entregas WHERE id = NEW.entrega_id;
    UPDATE public.sgsst_epis
       SET estoque_atual = estoque_atual + NEW.quantidade_devolvida, updated_at = now()
     WHERE id = v_epi_id;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.condicao_epi <> 'BOM' THEN
      RETURN NULL;
    END IF;

    SELECT epi_id INTO v_epi_id FROM public.sgsst_epi_entregas WHERE id = OLD.entrega_id;
    UPDATE public.sgsst_epis
       SET estoque_atual = GREATEST(0, estoque_atual - OLD.quantidade_devolvida), updated_at = now()
     WHERE id = v_epi_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_estoque_devolucao ON public.sgsst_epi_devolucoes;
CREATE TRIGGER trg_sgsst_epi_estoque_devolucao
  AFTER INSERT OR DELETE ON public.sgsst_epi_devolucoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_epi_estoque_devolucao();

-- =====================================================================
-- 5. Indices para as consultas paginadas
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_ent_empresa_data
  ON public.sgsst_epi_entregas(empresa_id, data_entrega DESC);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_dev_entrega
  ON public.sgsst_epi_devolucoes(entrega_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_dev_empresa_data
  ON public.sgsst_epi_devolucoes(empresa_id, data_devolucao DESC);
