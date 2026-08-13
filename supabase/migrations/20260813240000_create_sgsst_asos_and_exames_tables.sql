-- Migration: Create SGSST Exames Ocupacionais, ASO (Atestado de Saúde Ocupacional) e Histórico

-- 1. TABELA sgsst_exames
CREATE TABLE IF NOT EXISTS public.sgsst_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id uuid NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  pcmso_id uuid REFERENCES public.sgsst_pcmso(id) ON DELETE SET NULL,
  pcmso_exame_id uuid REFERENCES public.sgsst_pcmso_exames(id) ON DELETE SET NULL,
  nome_exame text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Admissional', 'Periódico', 'Retorno ao Trabalho', 'Mudança de Risco/Função', 'Demissional', 'Complementar', 'Outros')),
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  data_realizacao date,
  resultado text,
  medico_responsavel text,
  observacoes text,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'AGENDADO', 'REALIZADO', 'CANCELADO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_ex_empresa ON public.sgsst_exames(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ex_colab ON public.sgsst_exames(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ex_pcmso ON public.sgsst_exames(pcmso_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ex_status ON public.sgsst_exames(empresa_id, status);

ALTER TABLE public.sgsst_exames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_exames" ON public.sgsst_exames;
CREATE POLICY "Users view own empresa sgsst_exames" ON public.sgsst_exames
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_exames" ON public.sgsst_exames;
CREATE POLICY "Users insert own empresa sgsst_exames" ON public.sgsst_exames
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_exames" ON public.sgsst_exames;
CREATE POLICY "Users update own empresa sgsst_exames" ON public.sgsst_exames
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_exames" ON public.sgsst_exames;
CREATE POLICY "Users delete own empresa sgsst_exames" ON public.sgsst_exames
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_exames ON public.sgsst_exames;
CREATE TRIGGER audit_sgsst_exames
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_exames
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_asos
CREATE TABLE IF NOT EXISTS public.sgsst_asos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id uuid NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  exame_id uuid REFERENCES public.sgsst_exames(id) ON DELETE SET NULL,
  pcmso_id uuid REFERENCES public.sgsst_pcmso(id) ON DELETE SET NULL,
  numero_documento text,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL CHECK (tipo IN ('Admissional', 'Periódico', 'Retorno ao Trabalho', 'Mudança de Risco/Função', 'Demissional', 'Outros')),
  aptidao text NOT NULL DEFAULT 'APTO' CHECK (aptidao IN ('APTO', 'APTO_COM_RESTRICAO', 'INAPTO')),
  validade date NOT NULL,
  medico_responsavel text,
  crm_medico text,
  descricao_restricao text,
  data_inicio_restricao date,
  data_termino_restricao date,
  observacoes text,
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'SUBSTITUIDO', 'CANCELADO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_aso_empresa ON public.sgsst_asos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_colab ON public.sgsst_asos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_pcmso ON public.sgsst_asos(pcmso_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_validade ON public.sgsst_asos(empresa_id, validade);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_status ON public.sgsst_asos(empresa_id, status);

ALTER TABLE public.sgsst_asos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_asos" ON public.sgsst_asos;
CREATE POLICY "Users view own empresa sgsst_asos" ON public.sgsst_asos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_asos" ON public.sgsst_asos;
CREATE POLICY "Users insert own empresa sgsst_asos" ON public.sgsst_asos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_asos" ON public.sgsst_asos;
CREATE POLICY "Users update own empresa sgsst_asos" ON public.sgsst_asos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_asos" ON public.sgsst_asos;
CREATE POLICY "Users delete own empresa sgsst_asos" ON public.sgsst_asos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_asos ON public.sgsst_asos;
CREATE TRIGGER audit_sgsst_asos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_asos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_asos_historico
CREATE TABLE IF NOT EXISTS public.sgsst_asos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  aso_id uuid NOT NULL REFERENCES public.sgsst_asos(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_aso_hist_empresa ON public.sgsst_asos_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_hist_aso ON public.sgsst_asos_historico(aso_id);

ALTER TABLE public.sgsst_asos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_asos_historico" ON public.sgsst_asos_historico;
CREATE POLICY "Users view own empresa sgsst_asos_historico" ON public.sgsst_asos_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_asos_historico" ON public.sgsst_asos_historico;
CREATE POLICY "Users insert own empresa sgsst_asos_historico" ON public.sgsst_asos_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_asos_historico ON public.sgsst_asos_historico;
CREATE TRIGGER audit_sgsst_asos_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_asos_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_asos_tenant_integrity()
RETURNS trigger AS $$
BEGIN
  IF NEW.colaborador_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_colaborador_dados
      WHERE id = NEW.colaborador_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O colaborador informado não pertence à mesma empresa.';
    END IF;
  END IF;

  IF NEW.pcmso_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_pcmso
      WHERE id = NEW.pcmso_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O PCMSO informado não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_asos_tenant_check ON public.sgsst_asos;
CREATE TRIGGER trg_sgsst_asos_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_asos
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_asos_tenant_integrity();
