-- Migration: Create SGSST PCMSO (Programa de Controle Médico de Saúde Ocupacional), Exames Previstos e Histórico

-- 1. TABELA sgsst_pcmso
CREATE TABLE IF NOT EXISTS public.sgsst_pcmso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  responsavel text,
  medico_responsavel text,
  crm_medico text,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_revisao date,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'ATIVO', 'EM_REVISAO', 'ENCERRADO', 'CANCELADO')),
  objetivo text,
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_pcmso_empresa_codigo
  ON public.sgsst_pcmso(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_empresa ON public.sgsst_pcmso(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_projeto ON public.sgsst_pcmso(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_status ON public.sgsst_pcmso(empresa_id, status);

ALTER TABLE public.sgsst_pcmso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pcmso" ON public.sgsst_pcmso;
CREATE POLICY "Users view own empresa sgsst_pcmso" ON public.sgsst_pcmso
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pcmso" ON public.sgsst_pcmso;
CREATE POLICY "Users insert own empresa sgsst_pcmso" ON public.sgsst_pcmso
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pcmso" ON public.sgsst_pcmso;
CREATE POLICY "Users update own empresa sgsst_pcmso" ON public.sgsst_pcmso
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pcmso" ON public.sgsst_pcmso;
CREATE POLICY "Users delete own empresa sgsst_pcmso" ON public.sgsst_pcmso
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pcmso ON public.sgsst_pcmso;
CREATE TRIGGER audit_sgsst_pcmso
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pcmso
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_pcmso_exames
CREATE TABLE IF NOT EXISTS public.sgsst_pcmso_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pcmso_id uuid NOT NULL REFERENCES public.sgsst_pcmso(id) ON DELETE CASCADE,
  nome_exame text NOT NULL,
  tipo_exame text NOT NULL CHECK (tipo_exame IN ('Admissional', 'Periódico', 'Retorno ao Trabalho', 'Mudança de Risco/Função', 'Demissional', 'Outros')),
  periodicidade_meses integer DEFAULT 12,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  grupo_risco text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_ex_empresa ON public.sgsst_pcmso_exames(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_ex_pcmso ON public.sgsst_pcmso_exames(pcmso_id);

ALTER TABLE public.sgsst_pcmso_exames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames;
CREATE POLICY "Users view own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames;
CREATE POLICY "Users insert own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames;
CREATE POLICY "Users update own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames;
CREATE POLICY "Users delete own empresa sgsst_pcmso_exames" ON public.sgsst_pcmso_exames
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pcmso_exames ON public.sgsst_pcmso_exames;
CREATE TRIGGER audit_sgsst_pcmso_exames
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pcmso_exames
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_pcmso_historico
CREATE TABLE IF NOT EXISTS public.sgsst_pcmso_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pcmso_id uuid NOT NULL REFERENCES public.sgsst_pcmso(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_hist_empresa ON public.sgsst_pcmso_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_hist_pcmso ON public.sgsst_pcmso_historico(pcmso_id);

ALTER TABLE public.sgsst_pcmso_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pcmso_historico" ON public.sgsst_pcmso_historico;
CREATE POLICY "Users view own empresa sgsst_pcmso_historico" ON public.sgsst_pcmso_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pcmso_historico" ON public.sgsst_pcmso_historico;
CREATE POLICY "Users insert own empresa sgsst_pcmso_historico" ON public.sgsst_pcmso_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pcmso_historico ON public.sgsst_pcmso_historico;
CREATE TRIGGER audit_sgsst_pcmso_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pcmso_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_pcmso_tenant_integrity()
RETURNS trigger AS $$
BEGIN
  IF NEW.projeto_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projetos
      WHERE id = NEW.projeto_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O projeto/obra informado não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_pcmso_tenant_check ON public.sgsst_pcmso;
CREATE TRIGGER trg_sgsst_pcmso_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pcmso
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_pcmso_tenant_integrity();
