-- Migration: Create SGSST Não Conformidades, Ações e Histórico

-- 1. TABELA sgsst_nao_conformidades
CREATE TABLE IF NOT EXISTS public.sgsst_nao_conformidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  descricao text NOT NULL,
  origem_tipo text NOT NULL DEFAULT 'MANUAL' CHECK (origem_tipo IN ('INSPECAO', 'INCIDENTE', 'PGR', 'APR', 'PT', 'MANUAL')),
  origem_id uuid,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_identificacao date NOT NULL DEFAULT CURRENT_DATE,
  criticidade text NOT NULL DEFAULT 'MEDIA' CHECK (criticidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  prazo date,
  status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_ANALISE', 'PLANO_ACAO', 'EM_TRATAMENTO', 'AGUARDANDO_VERIFICACAO', 'CONCLUIDA', 'CANCELADA')),
  causa text,
  observacoes text,
  verificador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_verificacao date,
  resultado_verificacao text CHECK (resultado_verificacao IN ('ACEITA', 'REJEITADA')),
  observacao_verificacao text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_nc_empresa_codigo
  ON public.sgsst_nao_conformidades(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_nc_empresa ON public.sgsst_nao_conformidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_nc_projeto ON public.sgsst_nao_conformidades(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_nc_status ON public.sgsst_nao_conformidades(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_sgsst_nc_origem ON public.sgsst_nao_conformidades(empresa_id, origem_tipo, origem_id);

ALTER TABLE public.sgsst_nao_conformidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades;
CREATE POLICY "Users view own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades;
CREATE POLICY "Users insert own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades;
CREATE POLICY "Users update own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades;
CREATE POLICY "Users delete own empresa sgsst_nao_conformidades" ON public.sgsst_nao_conformidades
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_nao_conformidades ON public.sgsst_nao_conformidades;
CREATE TRIGGER audit_sgsst_nao_conformidades
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_nao_conformidades_acoes
CREATE TABLE IF NOT EXISTS public.sgsst_nao_conformidades_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nao_conformidade_id uuid NOT NULL REFERENCES public.sgsst_nao_conformidades(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'CORRETIVA' CHECK (tipo IN ('CORRETIVA', 'PREVENTIVA', 'CONTENCAO', 'MELHORIA')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  prioridade text NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  data_conclusao date,
  evidencia text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_nc_ac_empresa ON public.sgsst_nao_conformidades_acoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_nc_ac_nc ON public.sgsst_nao_conformidades_acoes(nao_conformidade_id);

ALTER TABLE public.sgsst_nao_conformidades_acoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes;
CREATE POLICY "Users view own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes;
CREATE POLICY "Users insert own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes;
CREATE POLICY "Users update own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes;
CREATE POLICY "Users delete own empresa sgsst_nao_conformidades_acoes" ON public.sgsst_nao_conformidades_acoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_nao_conformidades_acoes ON public.sgsst_nao_conformidades_acoes;
CREATE TRIGGER audit_sgsst_nao_conformidades_acoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_nao_conformidades_acoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_nao_conformidades_historico
CREATE TABLE IF NOT EXISTS public.sgsst_nao_conformidades_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nao_conformidade_id uuid NOT NULL REFERENCES public.sgsst_nao_conformidades(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_nc_hist_empresa ON public.sgsst_nao_conformidades_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_nc_hist_nc ON public.sgsst_nao_conformidades_historico(nao_conformidade_id);

ALTER TABLE public.sgsst_nao_conformidades_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_nao_conformidades_historico" ON public.sgsst_nao_conformidades_historico;
CREATE POLICY "Users view own empresa sgsst_nao_conformidades_historico" ON public.sgsst_nao_conformidades_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_nao_conformidades_historico" ON public.sgsst_nao_conformidades_historico;
CREATE POLICY "Users insert own empresa sgsst_nao_conformidades_historico" ON public.sgsst_nao_conformidades_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_nao_conformidades_historico ON public.sgsst_nao_conformidades_historico;
CREATE TRIGGER audit_sgsst_nao_conformidades_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_nao_conformidades_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_nao_conformidades_tenant_integrity()
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

DROP TRIGGER IF EXISTS trg_sgsst_nao_conformidades_tenant_check ON public.sgsst_nao_conformidades;
CREATE TRIGGER trg_sgsst_nao_conformidades_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_nao_conformidades_tenant_integrity();
