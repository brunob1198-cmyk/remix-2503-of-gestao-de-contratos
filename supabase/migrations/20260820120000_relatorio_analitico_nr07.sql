-- Migration: base do relatorio analitico anual do PCMSO (Fase 3 do plano)
--
-- A NR-07 item 7.6 exige um relatorio analitico anual, e ele estava 100% ausente.
-- Cinco dos seis itens exigidos saem de tabelas que ja existem; faltavam duas
-- coisas para os numeros fecharem:
--
--   1. O resultado do exame era TEXTO LIVRE. Sem padronizar, nao ha como contar
--      "resultados anormais", que e item obrigatorio do relatorio.
--   2. Nao havia cadastro de CAT. O relatorio precisa dos dados das Comunicacoes
--      de Acidente de Trabalho emitidas.
--
-- Confirmado com o usuario e verificado no banco em 20/08/2026: sgsst_exames
-- estava com 0 registros, entao a padronizacao nao precisa retro-classificar
-- nada e o default nao mascara dado existente.

-- =====================================================================
-- 1. Padronizacao do resultado do exame
-- =====================================================================
ALTER TABLE public.sgsst_exames
  -- Classificacao contavel. O `resultado` em texto livre CONTINUA existindo para
  -- o detalhe clinico: a classificacao e para estatistica, nao substitui o laudo.
  ADD COLUMN IF NOT EXISTS resultado_classificacao text
    CHECK (resultado_classificacao IS NULL
           OR resultado_classificacao IN ('NORMAL', 'ALTERADO', 'INCONCLUSIVO')),
  -- A NR-07 conta exames CLINICOS e COMPLEMENTARES separadamente no relatorio.
  -- O `tipo` que ja existia e a ocasiao (admissional, periodico...), nao a
  -- natureza. Default COMPLEMENTAR porque audiometria, espirometria e hemograma
  -- sao a maioria; o exame clinico e a consulta em si e o usuario marca.
  ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'COMPLEMENTAR'
    CHECK (natureza IN ('CLINICO', 'COMPLEMENTAR'));

COMMENT ON COLUMN public.sgsst_exames.resultado_classificacao IS
  'Classificacao contavel do achado (NR-07 7.6.2): NORMAL, ALTERADO ou INCONCLUSIVO. NULL = ainda nao classificado.';
COMMENT ON COLUMN public.sgsst_exames.resultado IS
  'Detalhe clinico em texto livre. Complementa resultado_classificacao, nao substitui.';
COMMENT ON COLUMN public.sgsst_exames.natureza IS
  'CLINICO = a consulta medica. COMPLEMENTAR = exame de apoio (laboratorial, imagem, audiometria).';

CREATE INDEX IF NOT EXISTS idx_sgsst_exames_classificacao
  ON public.sgsst_exames(empresa_id, resultado_classificacao)
  WHERE resultado_classificacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_exames_natureza_data
  ON public.sgsst_exames(empresa_id, natureza, data_realizacao);

-- =====================================================================
-- 2. Cadastro de CAT — Comunicacao de Acidente de Trabalho
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_cats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero_cat text,
  tipo_cat text NOT NULL DEFAULT 'INICIAL'
    CHECK (tipo_cat IN ('INICIAL', 'REABERTURA', 'COMUNICACAO_OBITO')),
  colaborador_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  -- Liga a CAT ao incidente que a originou, quando houver registro no modulo.
  incidente_id uuid REFERENCES public.sgsst_incidentes(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  data_acidente date NOT NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  -- Classificacao internacional da doenca/lesao, usada na estatistica por setor.
  cid text,
  descricao text,
  dias_afastamento integer DEFAULT 0 CHECK (dias_afastamento >= 0),
  houve_obito boolean NOT NULL DEFAULT false,
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_cats_empresa ON public.sgsst_cats(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_cats_data ON public.sgsst_cats(empresa_id, data_acidente);
CREATE INDEX IF NOT EXISTS idx_sgsst_cats_colab ON public.sgsst_cats(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_cats_incidente ON public.sgsst_cats(incidente_id);

-- Numero de CAT nao repete dentro da mesma empresa, quando informado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_cats_numero
  ON public.sgsst_cats(empresa_id, numero_cat)
  WHERE numero_cat IS NOT NULL;

ALTER TABLE public.sgsst_cats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_cats" ON public.sgsst_cats;
CREATE POLICY "Users view own empresa sgsst_cats" ON public.sgsst_cats
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_cats" ON public.sgsst_cats;
CREATE POLICY "Users insert own empresa sgsst_cats" ON public.sgsst_cats
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_cats" ON public.sgsst_cats;
CREATE POLICY "Users update own empresa sgsst_cats" ON public.sgsst_cats
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_cats" ON public.sgsst_cats;
CREATE POLICY "Users delete own empresa sgsst_cats" ON public.sgsst_cats
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_cats ON public.sgsst_cats;
CREATE TRIGGER audit_sgsst_cats
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_cats
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =====================================================================
-- 3. Integridade de tenant da CAT
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_sgsst_cats_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.colaborador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sgsst_colaborador_dados
    WHERE id = NEW.colaborador_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O colaborador informado não pertence à mesma empresa.';
  END IF;

  IF NEW.incidente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sgsst_incidentes
    WHERE id = NEW.incidente_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O incidente informado não pertence à mesma empresa.';
  END IF;

  -- Coerencia interna: CAT de obito precisa estar marcada como obito, e vice-versa.
  IF NEW.tipo_cat = 'COMUNICACAO_OBITO' AND NEW.houve_obito IS NOT TRUE THEN
    RAISE EXCEPTION 'CAT de comunicação de óbito precisa ter "houve óbito" marcado.';
  END IF;

  -- Acidente nao pode ser depois da emissao da CAT.
  IF NEW.data_acidente > NEW.data_emissao THEN
    RAISE EXCEPTION 'A data do acidente não pode ser posterior à data de emissão da CAT.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_cats_tenant_check ON public.sgsst_cats;
CREATE TRIGGER trg_sgsst_cats_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_cats
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_cats_tenant_integrity();
