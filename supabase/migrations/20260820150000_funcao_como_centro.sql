-- Migration: a Funcao passa a apontar para riscos, treinamentos e EPIs
-- (Fase 2 do plano de Seguranca)
--
-- O PROBLEMA: as sete referencias a sgsst_funcoes apontam todas PARA DENTRO dela
-- (colaborador tem funcao, APR tem funcao, PT tem funcao...). Nao existe o
-- contrario. Nenhuma tabela responde "quem exerce esta funcao esta exposto a
-- estes riscos, precisa destes treinamentos e destes EPIs".
--
-- Consequencia pratica: hoje essa informacao e digitada tres vezes em tres
-- telas — no PGR, no PCMSO e na matriz de treinamento — e nada garante que as
-- tres concordem. E e exatamente o conjunto que o eSocial S-2240 exige.
--
-- SOBRE O funcao_id QUE JA EXISTE EM sgsst_treinamentos: ele existe, mas e 1:1 —
-- um treinamento pertence a uma funcao. "NR-35 Trabalho em Altura" e exigido por
-- varias funcoes, entao aquele campo obriga a cadastrar o mesmo treinamento
-- repetido, um por funcao. As tabelas abaixo sao N:N. O campo antigo fica onde
-- esta (nao quebra nada) e o vinculo que ja houver e migrado.
--
-- A caracterizacao da exposicao (habitual/ocasional e duracao) fica na ligacao
-- funcao<->risco de proposito. A NR-01 1.5.7.3.2 pede isso no inventario do PGR,
-- mas o dado e constante por funcao, nao por documento: quem opera martelete
-- esta exposto a vibracao do mesmo jeito em qualquer obra. A fase 3 faz o
-- inventario do PGR herdar daqui em vez de pedir para redigitar.

-- =====================================================================
-- 1. Funcao <-> Riscos
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_funcao_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE CASCADE,
  risco_catalogo_id uuid NOT NULL REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE RESTRICT,

  -- Caracterizacao da exposicao — alinea que falta ao inventario do PGR.
  tipo_exposicao text NOT NULL DEFAULT 'HABITUAL'
    CHECK (tipo_exposicao IN ('HABITUAL', 'OCASIONAL', 'EVENTUAL')),
  tempo_exposicao text,

  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_funcao_riscos IS
  'Riscos a que uma funcao expoe quem a exerce. Fonte unica para PGR, PCMSO e eSocial S-2240.';
COMMENT ON COLUMN public.sgsst_funcao_riscos.tipo_exposicao IS
  'HABITUAL = parte rotineira da atividade. OCASIONAL = acontece com regularidade previsivel. EVENTUAL = raro e nao programado. NR-01 1.5.7.3.2 pede a caracterizacao da exposicao no inventario.';
COMMENT ON COLUMN public.sgsst_funcao_riscos.tempo_exposicao IS
  'Duracao da exposicao em texto livre (ex.: "8h/dia", "2h/semana"). Texto porque a unidade varia com o agente e a norma nao fixa formato.';

-- O mesmo risco nao entra duas vezes na mesma funcao.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_funcao_riscos
  ON public.sgsst_funcao_riscos(funcao_id, risco_catalogo_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_fr_empresa ON public.sgsst_funcao_riscos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_fr_funcao ON public.sgsst_funcao_riscos(funcao_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_fr_risco ON public.sgsst_funcao_riscos(risco_catalogo_id);

ALTER TABLE public.sgsst_funcao_riscos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos;
CREATE POLICY "Users view own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos;
CREATE POLICY "Users insert own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos;
CREATE POLICY "Users update own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos;
CREATE POLICY "Users delete own empresa sgsst_funcao_riscos" ON public.sgsst_funcao_riscos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_funcao_riscos ON public.sgsst_funcao_riscos;
CREATE TRIGGER audit_sgsst_funcao_riscos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_funcao_riscos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_funcao_riscos_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_funcoes
    WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_riscos_catalogo
    WHERE id = NEW.risco_catalogo_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O risco informado não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_funcao_riscos_tenant_check ON public.sgsst_funcao_riscos;
CREATE TRIGGER trg_sgsst_funcao_riscos_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_funcao_riscos
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_funcao_riscos_tenant_integrity();

-- =====================================================================
-- 2. Funcao <-> Treinamentos
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_funcao_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE CASCADE,
  treinamento_id uuid NOT NULL REFERENCES public.sgsst_treinamentos(id) ON DELETE RESTRICT,

  -- Obrigatorio entra na conta de pendencia; recomendado nao bloqueia ninguem.
  obrigatorio boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_funcao_treinamentos IS
  'Treinamentos exigidos por funcao (N:N). Substitui o funcao_id 1:1 de sgsst_treinamentos, que obrigava a duplicar o mesmo treinamento por funcao.';
COMMENT ON COLUMN public.sgsst_funcao_treinamentos.obrigatorio IS
  'True entra no indicador de pendencia da funcao. False e recomendacao e nao acusa falta.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_funcao_treinamentos
  ON public.sgsst_funcao_treinamentos(funcao_id, treinamento_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_ft_empresa ON public.sgsst_funcao_treinamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ft_funcao ON public.sgsst_funcao_treinamentos(funcao_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ft_treinamento ON public.sgsst_funcao_treinamentos(treinamento_id);

ALTER TABLE public.sgsst_funcao_treinamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos;
CREATE POLICY "Users view own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos;
CREATE POLICY "Users insert own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos;
CREATE POLICY "Users update own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos;
CREATE POLICY "Users delete own empresa sgsst_funcao_treinamentos" ON public.sgsst_funcao_treinamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_funcao_treinamentos ON public.sgsst_funcao_treinamentos;
CREATE TRIGGER audit_sgsst_funcao_treinamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_funcao_treinamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_funcao_treinamentos_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_funcoes
    WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_treinamentos
    WHERE id = NEW.treinamento_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O treinamento informado não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_funcao_treinamentos_tenant_check ON public.sgsst_funcao_treinamentos;
CREATE TRIGGER trg_sgsst_funcao_treinamentos_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_funcao_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_funcao_treinamentos_tenant_integrity();

-- =====================================================================
-- 3. Funcao <-> EPIs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_funcao_epis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.sgsst_epis(id) ON DELETE RESTRICT,

  obrigatorio boolean NOT NULL DEFAULT true,
  quantidade_padrao integer NOT NULL DEFAULT 1 CHECK (quantidade_padrao > 0),
  -- Sem periodicidade, uma entrega de tres anos atras continua contando como
  -- "entregue" para sempre. Nulo = sem troca programada.
  periodicidade_troca_meses integer CHECK (periodicidade_troca_meses IS NULL OR periodicidade_troca_meses > 0),

  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_funcao_epis IS
  'EPIs exigidos por funcao. Base da ficha de EPI do trabalhador e do indicador de entrega pendente.';
COMMENT ON COLUMN public.sgsst_funcao_epis.periodicidade_troca_meses IS
  'Meses entre trocas. Nulo significa sem troca programada — e diferente de zero, que nao e valido.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_funcao_epis
  ON public.sgsst_funcao_epis(funcao_id, epi_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_fe_empresa ON public.sgsst_funcao_epis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_fe_funcao ON public.sgsst_funcao_epis(funcao_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_fe_epi ON public.sgsst_funcao_epis(epi_id);

ALTER TABLE public.sgsst_funcao_epis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis;
CREATE POLICY "Users view own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis;
CREATE POLICY "Users insert own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis;
CREATE POLICY "Users update own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis;
CREATE POLICY "Users delete own empresa sgsst_funcao_epis" ON public.sgsst_funcao_epis
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_funcao_epis ON public.sgsst_funcao_epis;
CREATE TRIGGER audit_sgsst_funcao_epis
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_funcao_epis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_funcao_epis_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_funcoes
    WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_epis
    WHERE id = NEW.epi_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O EPI informado não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_funcao_epis_tenant_check ON public.sgsst_funcao_epis;
CREATE TRIGGER trg_sgsst_funcao_epis_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_funcao_epis
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_funcao_epis_tenant_integrity();

-- =====================================================================
-- 4. Aproveita o vinculo 1:1 que ja existia em sgsst_treinamentos
-- =====================================================================
-- Quem ja tinha amarrado treinamento a funcao pelo campo antigo nao perde o
-- trabalho. Idempotente pelo ON CONFLICT.
--
-- O EXISTS nao e redundante com o trigger de tenant: sem ele, uma unica linha
-- historica cujo funcao_id aponte para funcao de outra empresa faria o trigger
-- abortar a migration inteira. Aqui a linha inconsistente e apenas ignorada, e o
-- trigger continua valendo para tudo que a aplicacao inserir daqui em diante.
INSERT INTO public.sgsst_funcao_treinamentos (empresa_id, funcao_id, treinamento_id, obrigatorio)
SELECT t.empresa_id, t.funcao_id, t.id, t.obrigatorio
FROM public.sgsst_treinamentos t
WHERE t.funcao_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sgsst_funcoes f
    WHERE f.id = t.funcao_id AND f.empresa_id = t.empresa_id
  )
ON CONFLICT (funcao_id, treinamento_id) DO NOTHING;
