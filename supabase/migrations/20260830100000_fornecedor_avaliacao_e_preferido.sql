-- ============================================================================
-- Avaliação de fornecedor que realmente alimenta o score, e fornecedor preferido
-- ============================================================================
--
-- O modal de avaliação dizia, com estas palavras: "Avalie o fornecedor para
-- atualizar o seu Score." E não atualizava nada.
--
-- Ele gravava em `avaliacoes_fornecedor` e nunca tocava em
-- `fornecedores.score_prazo/preco/qualidade/responsividade`. O gatilho que
-- recalcula o `score` ponderado a partir dessas quatro colunas já existia desde
-- 2026-06-12 — só não havia ninguém alimentando as colunas. Resultado: o score de
-- todo fornecedor ficava no que fosse digitado à mão no cadastro, ou em zero.
--
-- E o comparativo de cotações precisa desse score: até a auditoria, o selo de
-- "melhor avaliação" era decidido por `razao_social.length % 5` — o número de letras
-- do nome do fornecedor.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O DESCASAMENTO DE ESCALA, QUE É O PONTO DELICADO DESTA MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────
--
-- O modal coleta ESTRELAS, de 1 a 5. A tela de fornecedores documenta os
-- componentes como "0 a 100" e classifica o score em faixas: verde acima de 70,
-- amarelo acima de 40, vermelho abaixo. A importação por Excel também assume 0 a 100.
--
-- Gravar a média das estrelas direto nas colunas colocaria todo fornecedor entre
-- 1 e 5 numa escala lida como 0 a 100 — ou seja, **todos apareceriam como
-- péssimos**, com selo vermelho, para sempre.
--
-- A conversão é explícita: **nota × 20**. Uma estrela vale 20 pontos, cinco valem
-- 100. Fica no banco, num lugar só, e não espalhada por telas.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- IDEMPOTENTE: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fornecedor preferido
-- ---------------------------------------------------------------------------
-- Marcação manual do comprador: fornecedor homologado, de confiança, que deve
-- aparecer primeiro na hora de escolher quem cotar. É diferente de score alto —
-- score é histórico medido, preferido é decisão de quem compra.

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS preferido boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fornecedores.preferido IS
  'Marcado manualmente pelo comprador: fornecedor homologado, que aparece primeiro na escolha de quem cotar. Distinto de score alto — score é histórico medido, preferido é decisão de quem compra.';

-- Índice parcial: a consulta procura os preferidos, e eles são a minoria.
CREATE INDEX IF NOT EXISTS idx_fornecedores_preferido
  ON public.fornecedores (empresa_id)
  WHERE preferido = true;

-- ---------------------------------------------------------------------------
-- 2. Quantas avaliações sustentam o score
-- ---------------------------------------------------------------------------
-- Score 100 vindo de UMA avaliação não é a mesma coisa que score 100 vindo de
-- vinte. Sem esse número ao lado, o score afirma mais do que os dados sustentam —
-- e é justamente com ele que se decide para quem vai o pedido.

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS avaliacoes_total integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fornecedores.avaliacoes_total IS
  'Quantas avaliações compõem o score. Score alto com total baixo é indício fraco, e a tela mostra o total ao lado do score justamente para isso.';

-- ---------------------------------------------------------------------------
-- 3. As notas são de 1 a 5, e o banco passa a exigir isso
-- ---------------------------------------------------------------------------
-- Sem o CHECK, uma nota 50 gravada por engano viraria 1000 pontos na conversão e
-- levaria o score do fornecedor para muito além do máximo.

DO $$
DECLARE
  v_coluna text;
BEGIN
  FOREACH v_coluna IN ARRAY ARRAY['nota_prazo', 'nota_preco', 'nota_qualidade', 'nota_responsividade']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = format('avaliacoes_fornecedor_%s_check', v_coluna)
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.avaliacoes_fornecedor ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I >= 1 AND %I <= 5))',
        format('avaliacoes_fornecedor_%s_check', v_coluna), v_coluna, v_coluna, v_coluna
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. A avaliação passa a alimentar o score
-- ---------------------------------------------------------------------------
-- Recalcula do zero a partir de TODAS as avaliações do fornecedor, em vez de
-- ajustar incrementalmente. É mais lento e é o certo: cálculo incremental erra
-- para sempre se uma avaliação for corrigida ou apagada, e não há como descobrir
-- depois que errou.
--
-- A média é feita sobre as notas PRESENTES de cada critério. `nota_responsividade`
-- é anulável, e critério sem nota nenhuma fica em zero — o que puxa o score
-- ponderado para baixo. É por isso que `avaliacoes_total` existe: o número ao lado
-- diz quanto o score pode ser levado a sério.

CREATE OR REPLACE FUNCTION public.recalcular_score_fornecedor(p_fornecedor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prazo numeric;
  v_preco numeric;
  v_qualidade numeric;
  v_responsividade numeric;
  v_total integer;
BEGIN
  SELECT
    -- Estrela vale 20 pontos: 1 → 20, 5 → 100. Ver o cabeçalho desta migration.
    COALESCE(ROUND(AVG(nota_prazo) * 20, 1), 0),
    COALESCE(ROUND(AVG(nota_preco) * 20, 1), 0),
    COALESCE(ROUND(AVG(nota_qualidade) * 20, 1), 0),
    COALESCE(ROUND(AVG(nota_responsividade) * 20, 1), 0),
    COUNT(*)
  INTO v_prazo, v_preco, v_qualidade, v_responsividade, v_total
  FROM public.avaliacoes_fornecedor
  WHERE fornecedor_id = p_fornecedor_id;

  -- O UPDATE nas quatro colunas dispara `tr_calculate_supplier_score`, que é quem
  -- recalcula o `score` ponderado (prazo 40%, preço 30%, qualidade 20%,
  -- responsividade 10%). Este função não duplica essa conta de propósito.
  UPDATE public.fornecedores
  SET score_prazo = v_prazo,
      score_preco = v_preco,
      score_qualidade = v_qualidade,
      score_responsividade = v_responsividade,
      avaliacoes_total = v_total
  WHERE id = p_fornecedor_id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_score_fornecedor(uuid) IS
  'Recalcula os componentes do score a partir de todas as avaliações do fornecedor. Estrela (1-5) vale 20 pontos na escala 0-100 que a tela usa.';

CREATE OR REPLACE FUNCTION public.fn_avaliacao_fornecedor_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_score_fornecedor(OLD.fornecedor_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalcular_score_fornecedor(NEW.fornecedor_id);

  -- Avaliação movida de fornecedor: o antigo também precisa perder a nota.
  IF TG_OP = 'UPDATE' AND OLD.fornecedor_id <> NEW.fornecedor_id THEN
    PERFORM public.recalcular_score_fornecedor(OLD.fornecedor_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacao_fornecedor_score ON public.avaliacoes_fornecedor;
CREATE TRIGGER trg_avaliacao_fornecedor_score
  AFTER INSERT OR UPDATE OR DELETE ON public.avaliacoes_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.fn_avaliacao_fornecedor_score();

-- ---------------------------------------------------------------------------
-- 5. Recalcula o que já existe
-- ---------------------------------------------------------------------------
-- Avaliações lançadas antes desta migration nunca chegaram ao score. Sem este
-- passo elas continuariam invisíveis, e o comparativo seguiria sem indicador.
--
-- Só toca em fornecedor QUE TEM avaliação: quem não tem mantém o score digitado à
-- mão no cadastro ou importado por planilha, e zerar isso apagaria informação que
-- alguém pôs ali de propósito.

DO $$
DECLARE
  v_id uuid;
  v_qtd integer := 0;
BEGIN
  FOR v_id IN
    SELECT DISTINCT fornecedor_id FROM public.avaliacoes_fornecedor
  LOOP
    PERFORM public.recalcular_score_fornecedor(v_id);
    v_qtd := v_qtd + 1;
  END LOOP;

  RAISE NOTICE 'Score recalculado para % fornecedor(es) com avaliação registrada.', v_qtd;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Dados objetivos do prazo
-- ---------------------------------------------------------------------------
-- As colunas `dias_prometidos`, `dias_entregues` e `atraso_dias` já existiam na
-- tabela e nenhuma tela as preenchia. São o contraponto da nota de prazo: a nota é
-- opinião, o atraso é fato, e o sistema conhece os dois — o pedido tem o prazo
-- prometido e a data de entrega real.

COMMENT ON COLUMN public.avaliacoes_fornecedor.dias_prometidos IS
  'Prazo que o fornecedor prometeu no pedido, em dias. Preenchido pelo sistema a partir do pedido — não é digitado.';
COMMENT ON COLUMN public.avaliacoes_fornecedor.dias_entregues IS
  'Dias efetivamente decorridos entre a emissão e a entrega. Calculado pelo sistema.';
COMMENT ON COLUMN public.avaliacoes_fornecedor.atraso_dias IS
  'Diferença entre entregue e prometido. Negativo significa entrega adiantada. É fato medido, ao lado da nota de prazo, que é opinião.';
