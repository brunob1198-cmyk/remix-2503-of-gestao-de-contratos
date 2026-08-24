-- Migration: higienizacao e manutencao periodica de EPI — NR-06 6.6.1 alinea "f"
--
-- A norma poe no empregador a obrigacao de "responsabilizar-se pela higienizacao e
-- manutencao periodica" do EPI. O modulo nao tinha onde registrar isso: sabia o
-- que foi entregue, a quem, e quando trocar — e nada sobre o equipamento ter sido
-- lavado, revisado ou condenado no meio do caminho.
--
-- Por que uma tabela e nao uma coluna: "periodica" significa varias ocorrencias ao
-- longo do tempo. Um campo `ultima_higienizacao` no EPI guardaria a ultima e
-- apagaria o historico — e o historico e justamente o que comprova periodicidade.
--
-- Duas decisoes de modelagem:
--
--   1. O registro aponta SEMPRE para o EPI e OPCIONALMENTE para a entrega. Isso
--      cobre as duas realidades da obra: higienizar o lote de mascaras que esta no
--      estoque (sem entrega) e higienizar o cinto que o Jose usa (com entrega, e
--      portanto com trabalhador identificado).
--
--   2. A manutencao pode concluir DESCARTADO. E o gancho com a alinea "e"
--      (substituir imediatamente o equipamento danificado): condenar o
--      equipamento e informacao operacional, nao observacao solta num campo de
--      texto.

-- =====================================================================
-- 1. Periodicidade, no cadastro do EPI
-- =====================================================================
-- Sem periodicidade cadastrada nao existe "atrasada": nao ha prazo a comparar. O
-- sistema entao diz "sem periodicidade" em vez de inventar um numero — reciclar
-- mascara descartavel e cinto de seguranca no mesmo ritmo faria o usuario aprender
-- a ignorar o aviso.
ALTER TABLE public.sgsst_epis
  ADD COLUMN IF NOT EXISTS higienizacao_periodicidade_dias integer,
  ADD COLUMN IF NOT EXISTS exige_higienizacao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sgsst_epis.higienizacao_periodicidade_dias IS
  'De quantos em quantos dias o equipamento deve ser higienizado ou revisado (NR-06 6.6.1 alinea "f"). Nulo = sem periodicidade definida, e o sistema nao cobra prazo.';

COMMENT ON COLUMN public.sgsst_epis.exige_higienizacao IS
  'Verdadeiro para equipamento reutilizavel que precisa de higienizacao/manutencao. Falso para descartavel — cobrar higienizacao de mascara PFF1 e ruido.';

-- =====================================================================
-- 2. Tabela de execucoes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_epi_manutencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,

  -- Sempre se sabe de que equipamento se trata.
  epi_id uuid NOT NULL REFERENCES public.sgsst_epis(id) ON DELETE RESTRICT,

  -- Preenchida quando a execucao e sobre a unidade que esta com um trabalhador.
  -- Nula quando e sobre itens do estoque.
  entrega_id uuid REFERENCES public.sgsst_epi_entregas(id) ON DELETE SET NULL,

  tipo text NOT NULL DEFAULT 'HIGIENIZACAO'
    CHECK (tipo IN ('HIGIENIZACAO', 'MANUTENCAO', 'INSPECAO')),

  data_execucao date NOT NULL DEFAULT CURRENT_DATE,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),

  -- Quem executou. Frequentemente e terceiro (lavanderia, assistencia do
  -- fabricante), por isso ha o campo de texto ao lado do vinculo com o usuario.
  executado_por_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  executado_por_nome text,

  resultado text NOT NULL DEFAULT 'APROVADO'
    CHECK (resultado IN ('APROVADO', 'REPROVADO', 'DESCARTADO')),

  -- Proxima execucao prevista. Pode ser informada ou calculada pela
  -- periodicidade do EPI.
  proxima_prevista date,

  observacao text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_epi_manutencoes IS
  'Execucoes de higienizacao, manutencao e inspecao de EPI — NR-06 6.6.1 alinea "f". Tabela e nao coluna porque "periodica" significa historico, e o historico e o que comprova a periodicidade.';

COMMENT ON COLUMN public.sgsst_epi_manutencoes.entrega_id IS
  'Entrega correspondente, quando a execucao e sobre a unidade que esta com um trabalhador. Nula quando e sobre itens do estoque.';

COMMENT ON COLUMN public.sgsst_epi_manutencoes.resultado IS
  'APROVADO: volta ao uso. REPROVADO: reprovado nesta execucao, aguarda decisao. DESCARTADO: equipamento condenado — gancho com a alinea "e", substituicao imediata.';

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_manut_empresa_data
  ON public.sgsst_epi_manutencoes(empresa_id, data_execucao DESC);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_manut_epi
  ON public.sgsst_epi_manutencoes(epi_id, data_execucao DESC);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_manut_entrega
  ON public.sgsst_epi_manutencoes(entrega_id)
  WHERE entrega_id IS NOT NULL;

-- =====================================================================
-- 3. RLS
-- =====================================================================
ALTER TABLE public.sgsst_epi_manutencoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes;
CREATE POLICY "Users view own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes;
CREATE POLICY "Users insert own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes;
CREATE POLICY "Users update own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes;
CREATE POLICY "Users delete own empresa sgsst_epi_manutencoes" ON public.sgsst_epi_manutencoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_epi_manutencoes ON public.sgsst_epi_manutencoes;
CREATE TRIGGER audit_sgsst_epi_manutencoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_epi_manutencoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =====================================================================
-- 4. Integridade
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_sgsst_epi_manutencao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_epi_da_entrega uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_epis
    WHERE id = NEW.epi_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: o EPI informado não pertence à mesma empresa.';
  END IF;

  IF NEW.entrega_id IS NOT NULL THEN
    SELECT epi_id INTO v_epi_da_entrega
      FROM public.sgsst_epi_entregas
     WHERE id = NEW.entrega_id AND empresa_id = NEW.empresa_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Violação de Multitenancy: a entrega informada não pertence à mesma empresa.';
    END IF;

    -- A entrega tem de ser do MESMO equipamento. Sem esta checagem, a ficha do
    -- trabalhador mostraria a higienizacao de um capacete na linha da luva dele.
    IF v_epi_da_entrega <> NEW.epi_id THEN
      RAISE EXCEPTION 'A entrega informada é de outro EPI. A execução deve apontar para a entrega do mesmo equipamento.';
    END IF;
  END IF;

  -- Execucao lancada antes de o equipamento existir na obra e erro de digitacao,
  -- e sairia impressa na ficha como prova de algo impossivel.
  IF NEW.entrega_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sgsst_epi_entregas
    WHERE id = NEW.entrega_id AND data_entrega > NEW.data_execucao
  ) THEN
    RAISE EXCEPTION 'A data da execução é anterior à data da entrega do equipamento.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_manutencao_valida ON public.sgsst_epi_manutencoes;
CREATE TRIGGER trg_sgsst_epi_manutencao_valida
  BEFORE INSERT OR UPDATE ON public.sgsst_epi_manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_epi_manutencao();

-- =====================================================================
-- 5. Descarte move o estoque
-- =====================================================================
-- Equipamento condenado deixou de existir. Se estava no ESTOQUE (sem entrega), o
-- estoque tem de cair — senao a tela segue oferecendo para entrega uma peca que
-- foi para o lixo. Se estava COM O TRABALHADOR (com entrega), nao ha estoque a
-- mexer: a peca ja havia saido na entrega.
--
-- Fica no mesmo lugar das outras movimentacoes, por trigger e com UPDATE relativo,
-- para nao reabrir a corrida que a migration anterior fechou.
CREATE OR REPLACE FUNCTION public.fn_sgsst_epi_estoque_manutencao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.resultado = 'DESCARTADO' AND NEW.entrega_id IS NULL THEN
      UPDATE public.sgsst_epis
         SET estoque_atual = GREATEST(0, estoque_atual - NEW.quantidade),
             updated_at = now()
       WHERE id = NEW.epi_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Apagar o registro de descarte devolve as pecas ao estoque, pelo mesmo
    -- motivo que apagar uma entrega devolve: corrigir lancamento errado nao pode
    -- custar estoque para sempre.
    IF OLD.resultado = 'DESCARTADO' AND OLD.entrega_id IS NULL THEN
      UPDATE public.sgsst_epis
         SET estoque_atual = estoque_atual + OLD.quantidade,
             updated_at = now()
       WHERE id = OLD.epi_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_estoque_manutencao ON public.sgsst_epi_manutencoes;
CREATE TRIGGER trg_sgsst_epi_estoque_manutencao
  AFTER INSERT OR DELETE ON public.sgsst_epi_manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_epi_estoque_manutencao();

-- =====================================================================
-- 6. Historico do modulo
-- =====================================================================
-- O modulo de EPI ja registra entrega e devolucao em `sgsst_epi_historico`. A
-- execucao de higienizacao entra na mesma trilha, senao a auditoria do EPI conta
-- metade da vida dele.
CREATE OR REPLACE FUNCTION public.fn_sgsst_epi_manutencao_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador_id uuid;
BEGIN
  IF NEW.entrega_id IS NOT NULL THEN
    SELECT colaborador_id INTO v_colaborador_id
      FROM public.sgsst_epi_entregas WHERE id = NEW.entrega_id;
  END IF;

  INSERT INTO public.sgsst_epi_historico (
    empresa_id, epi_id, colaborador_id, usuario_id, operacao, quantidade, observacao
  ) VALUES (
    NEW.empresa_id,
    NEW.epi_id,
    v_colaborador_id,
    NEW.created_by,
    NEW.tipo,
    NEW.quantidade,
    format('%s de %s unidade(s) — resultado: %s', NEW.tipo, NEW.quantidade, NEW.resultado)
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_epi_manutencao_historico ON public.sgsst_epi_manutencoes;
CREATE TRIGGER trg_sgsst_epi_manutencao_historico
  AFTER INSERT ON public.sgsst_epi_manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_epi_manutencao_historico();
