-- Migration: clinicas credenciadas e agendamento de exames (Fase 4 do plano)
--
-- O que falta para o modulo sair da planilha:
--
--   1. O nome da clinica era digitado a mao em cada exame. Sem cadastro, nao ha
--      como filtrar por prestador nem reaproveitar contato e endereco.
--   2. Nao havia agendamento. Marcar e remarcar vivia em planilha ou WhatsApp.
--
-- A convocacao em si nao precisa de tabela: e derivada da periodicidade do PCMSO,
-- da faixa etaria (criada na fase 1) e da data do ultimo exame de cada trabalhador.

-- =====================================================================
-- 1. Clinicas credenciadas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  cnpj text,
  responsavel_tecnico text,
  crm_responsavel text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text CHECK (uf IS NULL OR length(uf) = 2),
  -- Quais exames a clinica realiza, em texto livre: um credenciamento nao tem
  -- lista fechada e obrigar cadastro estruturado aqui atrapalharia mais do que
  -- ajudaria.
  exames_realizados text,
  observacoes text,
  status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'INATIVA')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_clinicas_empresa ON public.sgsst_clinicas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_clinicas_status ON public.sgsst_clinicas(empresa_id, status);

-- Nao repete CNPJ de clinica dentro da mesma empresa, quando informado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_clinicas_cnpj
  ON public.sgsst_clinicas(empresa_id, cnpj)
  WHERE cnpj IS NOT NULL;

ALTER TABLE public.sgsst_clinicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_clinicas" ON public.sgsst_clinicas;
CREATE POLICY "Users view own empresa sgsst_clinicas" ON public.sgsst_clinicas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_clinicas" ON public.sgsst_clinicas;
CREATE POLICY "Users insert own empresa sgsst_clinicas" ON public.sgsst_clinicas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_clinicas" ON public.sgsst_clinicas;
CREATE POLICY "Users update own empresa sgsst_clinicas" ON public.sgsst_clinicas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_clinicas" ON public.sgsst_clinicas;
CREATE POLICY "Users delete own empresa sgsst_clinicas" ON public.sgsst_clinicas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_clinicas ON public.sgsst_clinicas;
CREATE TRIGGER audit_sgsst_clinicas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_clinicas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =====================================================================
-- 2. Agendamento no exame
-- =====================================================================
ALTER TABLE public.sgsst_exames
  ADD COLUMN IF NOT EXISTS clinica_id uuid
    REFERENCES public.sgsst_clinicas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_agendada date,
  ADD COLUMN IF NOT EXISTS hora_agendada time,
  -- Contador de remarcacoes: sem isto nao ha como ver que um exame foi empurrado
  -- cinco vezes, que e exatamente o caso que interessa acompanhar.
  ADD COLUMN IF NOT EXISTS remarcacoes integer NOT NULL DEFAULT 0
    CHECK (remarcacoes >= 0),
  ADD COLUMN IF NOT EXISTS motivo_remarcacao text;

COMMENT ON COLUMN public.sgsst_exames.clinica_id IS
  'Clinica credenciada que realiza o exame. Substitui o nome digitado a mao.';
COMMENT ON COLUMN public.sgsst_exames.remarcacoes IS
  'Quantas vezes a data agendada foi alterada. Um exame remarcado varias vezes e sinal de problema.';

CREATE INDEX IF NOT EXISTS idx_sgsst_exames_agenda
  ON public.sgsst_exames(empresa_id, data_agendada)
  WHERE data_agendada IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_exames_clinica
  ON public.sgsst_exames(clinica_id)
  WHERE clinica_id IS NOT NULL;

-- Conta a remarcacao automaticamente: deixar isso na aplicacao significaria que
-- uma alteracao feita por outro caminho nao seria contada.
CREATE OR REPLACE FUNCTION public.fn_sgsst_exame_conta_remarcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.data_agendada IS NOT NULL
     AND NEW.data_agendada IS DISTINCT FROM OLD.data_agendada THEN
    NEW.remarcacoes := COALESCE(OLD.remarcacoes, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_exame_remarcacao ON public.sgsst_exames;
CREATE TRIGGER trg_sgsst_exame_remarcacao
  BEFORE UPDATE ON public.sgsst_exames
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_exame_conta_remarcacao();

-- =====================================================================
-- 3. Integridade de tenant da clinica no exame
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_sgsst_exame_clinica_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.clinica_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sgsst_clinicas
    WHERE id = NEW.clinica_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A clínica informada não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_exame_clinica_tenant ON public.sgsst_exames;
CREATE TRIGGER trg_sgsst_exame_clinica_tenant
  BEFORE INSERT OR UPDATE ON public.sgsst_exames
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_exame_clinica_tenant();
