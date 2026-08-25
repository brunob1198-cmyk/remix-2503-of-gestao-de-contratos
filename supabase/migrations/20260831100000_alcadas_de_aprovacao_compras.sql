-- ============================================================================
-- Alçadas de aprovação: por faixa de valor e por tipo de compra
-- ============================================================================
--
-- Hoje a autorização para aprovar compra é UM BOOLEANO por usuário:
-- `profiles.pode_aprovar_compra`. Quem tem a marcação aprova qualquer valor — a
-- requisição de R$ 200 em parafusos e a de R$ 400 mil em concreto passam pela
-- mesma checagem.
--
-- Não é falta de zelo de quem construiu: até a fase anterior o fluxo não tinha
-- sequer uma PARADA de aprovação. `PENDING_APPROVAL` era lido em quatro lugares e
-- escrito em nenhum, então não havia onde encaixar uma regra de valor. Agora há.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A DECISÃO MAIS IMPORTANTE: O QUE FAZER SEM REGRA CONFIGURADA
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Bloquear tudo até alguém cadastrar as alçadas deixaria o sistema sem aprovar
-- compra nenhuma no instante em que esta migration rodasse — inclusive as que já
-- estão em andamento.
--
-- Então: **sem nenhuma alçada cadastrada, vale a regra antiga** (o booleano por
-- usuário), e a tela DIZ que está assim. A partir da primeira alçada cadastrada, a
-- regra passa a valer estritamente, e valor fora de qualquer faixa é RECUSADO em vez
-- de liberado por omissão.
--
-- É a diferença entre "ainda não configurado" e "configurado e não autoriza" — e as
-- duas coisas precisam ser distinguíveis, ou o silêncio da tabela vazia viraria
-- permissão implícita.
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipo de compra na requisição
-- ---------------------------------------------------------------------------
-- A alçada da benchmark é "por faixa de valor E por tipo de compra": comprar
-- R$ 50 mil de material não é a mesma decisão que contratar R$ 50 mil de serviço,
-- e a empresa pode querer aprovadores diferentes para cada um.
--
-- Nulo é permitido: toda requisição já existente tem tipo nulo, e inventar um tipo
-- para ela seria afirmar uma classificação que ninguém fez.

ALTER TABLE public.requisicoes_compra
  ADD COLUMN IF NOT EXISTS tipo_compra text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'requisicoes_compra_tipo_compra_check'
  ) THEN
    ALTER TABLE public.requisicoes_compra
      ADD CONSTRAINT requisicoes_compra_tipo_compra_check
      CHECK (
        tipo_compra IS NULL OR tipo_compra IN
        ('MATERIAL', 'SERVICO', 'LOCACAO', 'EQUIPAMENTO', 'EPI', 'OUTROS')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.requisicoes_compra.tipo_compra IS
  'Natureza da compra, para a alçada poder distinguir material de serviço. NULL em requisição anterior a esta migration — e a alçada sem tipo (que vale para qualquer um) é quem cobre esse caso.';

-- ---------------------------------------------------------------------------
-- 2. As alçadas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sc_alcadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),

  nome text NOT NULL,

  /*
   * Faixa de valor, em reais, do total da cotação vencedora.
   *
   * `valor_maximo` nulo significa SEM TETO — é a alçada mais alta, e é ela que
   * evita que uma compra grande fique sem ninguém que possa aprová-la. A tela
   * avisa quando não existe nenhuma alçada sem teto.
   */
  valor_minimo numeric NOT NULL DEFAULT 0,
  valor_maximo numeric,

  /* Nulo vale para QUALQUER tipo de compra. */
  tipo_compra text,

  ativo boolean NOT NULL DEFAULT true,
  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sc_alcadas_faixa_check CHECK (
    valor_minimo >= 0 AND (valor_maximo IS NULL OR valor_maximo > valor_minimo)
  ),
  CONSTRAINT sc_alcadas_tipo_compra_check CHECK (
    tipo_compra IS NULL OR tipo_compra IN
    ('MATERIAL', 'SERVICO', 'LOCACAO', 'EQUIPAMENTO', 'EPI', 'OUTROS')
  )
);

COMMENT ON TABLE public.sc_alcadas IS
  'Regras de alçada de aprovação de compra, por faixa de valor e tipo. Tabela vazia mantém a regra antiga (booleano por usuário); a primeira linha cadastrada passa a valer estritamente.';
COMMENT ON COLUMN public.sc_alcadas.valor_maximo IS
  'Teto da faixa. NULL = sem teto, e é a alçada que impede uma compra grande de ficar sem aprovador possível.';
COMMENT ON COLUMN public.sc_alcadas.tipo_compra IS
  'NULL vale para qualquer tipo. Uma alçada específica de um tipo tem precedência sobre a genérica na mesma faixa.';

-- ---------------------------------------------------------------------------
-- 3. Quem aprova em cada alçada
-- ---------------------------------------------------------------------------
-- Por USUÁRIO, e não por papel. O papel neste sistema é grosso (`admin`,
-- `cliente`), e a autorização de compra é nominal: quem responde por uma aprovação
-- de R$ 300 mil é uma pessoa, não um cargo genérico.

CREATE TABLE IF NOT EXISTS public.sc_alcada_aprovadores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alcada_id uuid NOT NULL REFERENCES public.sc_alcadas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- O mesmo aprovador duas vezes na mesma alçada não significa nada.
  CONSTRAINT sc_alcada_aprovadores_unico UNIQUE (alcada_id, user_id)
);

COMMENT ON TABLE public.sc_alcada_aprovadores IS
  'Quem pode aprovar em cada alçada. Nominal, e não por papel: quem responde por uma aprovação de valor alto é uma pessoa.';

CREATE INDEX IF NOT EXISTS idx_sc_alcadas_empresa
  ON public.sc_alcadas (empresa_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_sc_alcada_aprovadores_user
  ON public.sc_alcada_aprovadores (user_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.sc_alcadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_alcada_aprovadores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Ver: todo usuário da empresa. Quem submete uma requisição precisa saber quem
  -- vai poder aprová-la, e esconder isso só produziria pergunta no corredor.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcadas' AND policyname = 'sc_alcadas_select') THEN
    CREATE POLICY sc_alcadas_select ON public.sc_alcadas FOR SELECT TO authenticated
      USING (empresa_id = get_user_empresa_id(auth.uid()));
  END IF;

  -- Mexer nas alçadas é administrar quem pode gastar o dinheiro da empresa: só admin.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcadas' AND policyname = 'sc_alcadas_insert') THEN
    CREATE POLICY sc_alcadas_insert ON public.sc_alcadas FOR INSERT TO authenticated
      WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcadas' AND policyname = 'sc_alcadas_update') THEN
    CREATE POLICY sc_alcadas_update ON public.sc_alcadas FOR UPDATE TO authenticated
      USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcadas' AND policyname = 'sc_alcadas_delete') THEN
    CREATE POLICY sc_alcadas_delete ON public.sc_alcadas FOR DELETE TO authenticated
      USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcada_aprovadores' AND policyname = 'sc_alcada_aprovadores_select') THEN
    CREATE POLICY sc_alcada_aprovadores_select ON public.sc_alcada_aprovadores FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.sc_alcadas a
        WHERE a.id = sc_alcada_aprovadores.alcada_id
          AND a.empresa_id = get_user_empresa_id(auth.uid())
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcada_aprovadores' AND policyname = 'sc_alcada_aprovadores_insert') THEN
    CREATE POLICY sc_alcada_aprovadores_insert ON public.sc_alcada_aprovadores FOR INSERT TO authenticated
      WITH CHECK (
        has_role(auth.uid(), 'admin') AND EXISTS (
          SELECT 1 FROM public.sc_alcadas a
          WHERE a.id = sc_alcada_aprovadores.alcada_id
            AND a.empresa_id = get_user_empresa_id(auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sc_alcada_aprovadores' AND policyname = 'sc_alcada_aprovadores_delete') THEN
    CREATE POLICY sc_alcada_aprovadores_delete ON public.sc_alcada_aprovadores FOR DELETE TO authenticated
      USING (
        has_role(auth.uid(), 'admin') AND EXISTS (
          SELECT 1 FROM public.sc_alcadas a
          WHERE a.id = sc_alcada_aprovadores.alcada_id
            AND a.empresa_id = get_user_empresa_id(auth.uid())
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_sc_alcadas_updated_at ON public.sc_alcadas;
CREATE TRIGGER update_sc_alcadas_updated_at
  BEFORE UPDATE ON public.sc_alcadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. A trava do lado do banco
-- ---------------------------------------------------------------------------
-- A tela impede, mas a tela é o lado de fora. Aprovar uma requisição é um UPDATE em
-- `requisicoes_compra`, e quem chegar ao PostgREST direto passaria por cima da
-- regra — que é justamente a regra sobre quem pode comprometer o dinheiro.
--
-- O trigger só age na transição PARA `APPROVED`: qualquer outra alteração da
-- requisição continua livre.

CREATE OR REPLACE FUNCTION public.check_alcada_aprovacao_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_tem_alcada boolean;
  v_autorizado boolean;
  v_faixa_existe boolean;
BEGIN
  -- Só interessa a entrada em APPROVED.
  IF NEW.workflow_status <> 'APPROVED' OR COALESCE(OLD.workflow_status, '') = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sc_alcadas WHERE empresa_id = NEW.empresa_id AND ativo = true
  ) INTO v_tem_alcada;

  -- Nenhuma alçada cadastrada: vale a regra antiga. Ver o cabeçalho.
  IF NOT v_tem_alcada THEN
    RETURN NEW;
  END IF;

  -- O valor é o da cotação vencedora. Sem vencedora, não há valor a comparar, e
  -- aprovar sem valor é o que a alçada existe para impedir.
  SELECT COALESCE(MAX(valor_total), 0) INTO v_valor
  FROM public.cotacoes
  WHERE requisicao_id = NEW.id AND status = 'aprovada';

  IF v_valor <= 0 THEN
    RAISE EXCEPTION
      'Não há cotação vencedora com valor nesta requisição. A alçada de aprovação não tem valor para conferir.';
  END IF;

  -- Existe alguma faixa que cubra este valor e este tipo?
  SELECT EXISTS (
    SELECT 1 FROM public.sc_alcadas a
    WHERE a.empresa_id = NEW.empresa_id
      AND a.ativo = true
      AND v_valor >= a.valor_minimo
      AND (a.valor_maximo IS NULL OR v_valor <= a.valor_maximo)
      AND (a.tipo_compra IS NULL OR a.tipo_compra = NEW.tipo_compra)
  ) INTO v_faixa_existe;

  IF NOT v_faixa_existe THEN
    RAISE EXCEPTION
      'Nenhuma alçada cobre R$ % para este tipo de compra. Cadastre uma alçada para esta faixa antes de aprovar.',
      to_char(v_valor, 'FM999G999G999D00');
  END IF;

  -- O usuário é aprovador de alguma alçada que cobre o valor?
  SELECT EXISTS (
    SELECT 1
    FROM public.sc_alcadas a
    JOIN public.sc_alcada_aprovadores ap ON ap.alcada_id = a.id
    WHERE a.empresa_id = NEW.empresa_id
      AND a.ativo = true
      AND ap.user_id = auth.uid()
      AND v_valor >= a.valor_minimo
      AND (a.valor_maximo IS NULL OR v_valor <= a.valor_maximo)
      AND (a.tipo_compra IS NULL OR a.tipo_compra = NEW.tipo_compra)
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION
      'Você não tem alçada para aprovar R$ %. Encaminhe a aprovação a quem tem.',
      to_char(v_valor, 'FM999G999G999D00');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_alcada_aprovacao_compra() IS
  'Barra a aprovação de requisição acima da alçada do usuário. Tabela de alçadas vazia mantém a regra antiga; a partir da primeira alçada, valor fora de qualquer faixa é recusado em vez de liberado.';

DROP TRIGGER IF EXISTS trg_check_alcada_aprovacao ON public.requisicoes_compra;
CREATE TRIGGER trg_check_alcada_aprovacao
  BEFORE UPDATE ON public.requisicoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.check_alcada_aprovacao_compra();
