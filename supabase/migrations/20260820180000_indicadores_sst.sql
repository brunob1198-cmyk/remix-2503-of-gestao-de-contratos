-- Migration: indicadores de SST (Fase 5 do plano de Seguranca)
--
-- O modulo tinha contagens ("12 incidentes") mas nao tinha os indicadores que a
-- area de fato usa e reporta: taxa de frequencia e taxa de gravidade, definidas
-- pela NBR 14280.
--
--   Taxa de frequencia = (acidentes com afastamento x 1.000.000) / HHT
--   Taxa de gravidade  = ((dias perdidos + dias debitados) x 1.000.000) / HHT
--
-- Faltavam as duas pontas da conta:
--
--   1. O NUMERADOR da gravidade. `sgsst_incidentes` tinha o tipo "Acidente com
--      Afastamento", mas nao quantos dias foram perdidos. Sem isso a gravidade
--      nao existe.
--
--   2. O DENOMINADOR de ambas: HHT, homens-hora trabalhadas. Nao havia nada.
--
-- Sobre o HHT: o app JA tem horas trabalhadas por pessoa e por dia em
-- `diario_equipe.horas`, ligado ao diario de obra. A aplicacao usa esse total
-- como valor sugerido, mas o numero que vale e o informado aqui — quem fecha o
-- indicador mensal tira o HHT da folha, nao do diario, e o diario pode estar
-- incompleto.
--
-- Importante sobre a direcao do erro: HHT subestimado (diario incompleto) INFLA
-- as taxas, porque o HHT e divisor. Isso e o vies seguro para indicador de
-- seguranca — erra para pior, nao para melhor. A tela diz de onde veio o numero.

-- =====================================================================
-- 1. Dias perdidos e debitados no incidente
-- =====================================================================
ALTER TABLE public.sgsst_incidentes
  -- Dias de afastamento efetivamente perdidos.
  ADD COLUMN IF NOT EXISTS dias_perdidos integer
    CHECK (dias_perdidos IS NULL OR dias_perdidos >= 0),
  -- Dias DEBITADOS: a NBR 14280 atribui um numero fixo de dias a cada tipo de
  -- perda permanente (morte, invalidez, perda de membro). Entram na gravidade
  -- somados aos dias perdidos.
  ADD COLUMN IF NOT EXISTS dias_debitados integer
    CHECK (dias_debitados IS NULL OR dias_debitados >= 0),
  ADD COLUMN IF NOT EXISTS data_afastamento date,
  ADD COLUMN IF NOT EXISTS data_retorno date,
  -- Comunicacao de Acidente de Trabalho emitida. Ja existe a tabela sgsst_cats
  -- (fase 3 do PCMSO); aqui e so o registro de que houve emissao, para o
  -- indicador de "acidente com afastamento sem CAT" ser possivel.
  ADD COLUMN IF NOT EXISTS cat_emitida boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sgsst_incidentes.dias_perdidos IS
  'Dias de afastamento perdidos. Numerador da taxa de gravidade (NBR 14280).';
COMMENT ON COLUMN public.sgsst_incidentes.dias_debitados IS
  'Dias debitados pela NBR 14280 para perda permanente (obito, invalidez, perda de membro). Somam aos dias perdidos na taxa de gravidade.';
COMMENT ON COLUMN public.sgsst_incidentes.cat_emitida IS
  'CAT emitida. Permite o indicador de acidente com afastamento sem CAT — que e irregularidade, nao lacuna de cadastro.';

CREATE INDEX IF NOT EXISTS idx_sgsst_incidente_data
  ON public.sgsst_incidentes(empresa_id, data_ocorrencia DESC);

-- Coerencia de datas: retorno antes do afastamento e erro de digitacao, e
-- passaria a producao inflando ou zerando a gravidade sem ninguem notar.
CREATE OR REPLACE FUNCTION public.check_sgsst_incidente_datas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_afastamento IS NOT NULL
     AND NEW.data_retorno IS NOT NULL
     AND NEW.data_retorno < NEW.data_afastamento THEN
    RAISE EXCEPTION 'A data de retorno não pode ser anterior à data de afastamento.';
  END IF;

  IF NEW.data_afastamento IS NOT NULL
     AND NEW.data_afastamento < NEW.data_ocorrencia THEN
    RAISE EXCEPTION 'A data de afastamento não pode ser anterior à data da ocorrência.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_incidente_datas ON public.sgsst_incidentes;
CREATE TRIGGER trg_sgsst_incidente_datas
  BEFORE INSERT OR UPDATE ON public.sgsst_incidentes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_incidente_datas();

-- =====================================================================
-- 2. Homens-hora trabalhadas (HHT)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_hht (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  -- Nulo = HHT da empresa inteira no periodo. A taxa faz sentido nas duas
  -- granularidades, e forcar obra impediria o indicador consolidado.
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,

  ano integer NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  horas numeric NOT NULL CHECK (horas > 0),

  -- De onde veio o numero. Aparece na tela junto do indicador: taxa calculada
  -- sobre HHT estimado nao pode se passar por taxa calculada sobre folha.
  origem text NOT NULL DEFAULT 'MANUAL'
    CHECK (origem IN ('MANUAL', 'DIARIO_OBRA', 'FOLHA')),
  media_trabalhadores integer CHECK (media_trabalhadores IS NULL OR media_trabalhadores >= 0),
  observacao text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_hht IS
  'Homens-hora trabalhadas por mes. Denominador das taxas de frequencia e gravidade (NBR 14280). Sem HHT as taxas nao existem — e melhor mostrar "—" que um numero inventado.';
COMMENT ON COLUMN public.sgsst_hht.projeto_id IS
  'Nulo significa HHT consolidado da empresa no periodo. As taxas fazem sentido por obra e no consolidado.';
COMMENT ON COLUMN public.sgsst_hht.origem IS
  'MANUAL (digitado), DIARIO_OBRA (somado de diario_equipe.horas) ou FOLHA (do departamento pessoal). Diario incompleto subestima o HHT e INFLA as taxas, porque HHT e divisor.';

-- Um HHT por obra e mes. O UNIQUE parcial cobre o consolidado (projeto nulo),
-- que o UNIQUE comum ignoraria — em Postgres, NULL nao colide com NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_hht_projeto_periodo
  ON public.sgsst_hht(empresa_id, projeto_id, ano, mes)
  WHERE projeto_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_hht_consolidado_periodo
  ON public.sgsst_hht(empresa_id, ano, mes)
  WHERE projeto_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_hht_empresa_periodo
  ON public.sgsst_hht(empresa_id, ano DESC, mes DESC);

ALTER TABLE public.sgsst_hht ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_hht" ON public.sgsst_hht;
CREATE POLICY "Users view own empresa sgsst_hht" ON public.sgsst_hht
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_hht" ON public.sgsst_hht;
CREATE POLICY "Users insert own empresa sgsst_hht" ON public.sgsst_hht
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_hht" ON public.sgsst_hht;
CREATE POLICY "Users update own empresa sgsst_hht" ON public.sgsst_hht
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_hht" ON public.sgsst_hht;
CREATE POLICY "Users delete own empresa sgsst_hht" ON public.sgsst_hht
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_hht ON public.sgsst_hht;
CREATE TRIGGER audit_sgsst_hht
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_hht
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_hht_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.projeto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = NEW.projeto_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A obra informada não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_hht_tenant_check ON public.sgsst_hht;
CREATE TRIGGER trg_sgsst_hht_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_hht
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_hht_tenant_integrity();
