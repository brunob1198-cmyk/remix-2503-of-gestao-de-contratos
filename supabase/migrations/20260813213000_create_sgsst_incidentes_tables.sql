-- Migration: Create SGSST Incidentes e Acidentes, Envolvidos, Investigação, Ações e Histórico

-- 1. TABELA sgsst_incidentes
CREATE TABLE IF NOT EXISTS public.sgsst_incidentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  codigo text,
  tipo text NOT NULL CHECK (tipo IN ('Incidente', 'Acidente', 'Quase Acidente', 'Acidente com Afastamento', 'Acidente sem Afastamento', 'Ocorrência Ambiental', 'Outros')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  local_ocorrencia text,
  data_ocorrencia date NOT NULL DEFAULT CURRENT_DATE,
  hora_ocorrencia time,
  responsavel_registro_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gravidade text NOT NULL DEFAULT 'MEDIA' CHECK (gravidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  status text NOT NULL DEFAULT 'REGISTRADO' CHECK (status IN ('REGISTRADO', 'EM_INVESTIGACAO', 'PLANO_ACAO', 'EM_TRATAMENTO', 'ENCERRADO', 'CANCELADO')),
  observacoes text,
  pgr_id uuid REFERENCES public.sgsst_pgr(id) ON DELETE SET NULL,
  apr_id uuid REFERENCES public.sgsst_apr(id) ON DELETE SET NULL,
  pt_id uuid REFERENCES public.sgsst_pt(id) ON DELETE SET NULL,
  inspecao_id uuid REFERENCES public.sgsst_inspecoes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_incidente_empresa_codigo
  ON public.sgsst_incidentes(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_incidente_empresa ON public.sgsst_incidentes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_incidente_projeto ON public.sgsst_incidentes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_incidente_status ON public.sgsst_incidentes(empresa_id, status);

ALTER TABLE public.sgsst_incidentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_incidentes" ON public.sgsst_incidentes;
CREATE POLICY "Users view own empresa sgsst_incidentes" ON public.sgsst_incidentes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_incidentes" ON public.sgsst_incidentes;
CREATE POLICY "Users insert own empresa sgsst_incidentes" ON public.sgsst_incidentes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_incidentes" ON public.sgsst_incidentes;
CREATE POLICY "Users update own empresa sgsst_incidentes" ON public.sgsst_incidentes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_incidentes" ON public.sgsst_incidentes;
CREATE POLICY "Users delete own empresa sgsst_incidentes" ON public.sgsst_incidentes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_incidentes ON public.sgsst_incidentes;
CREATE TRIGGER audit_sgsst_incidentes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_incidentes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_incidentes_envolvidos
CREATE TABLE IF NOT EXISTS public.sgsst_incidentes_envolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  incidente_id uuid NOT NULL REFERENCES public.sgsst_incidentes(id) ON DELETE CASCADE,
  colaborador_dados_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  tipo_envolvimento text NOT NULL CHECK (tipo_envolvimento IN ('Vítima', 'Testemunha', 'Envolvido', 'Comunicante', 'Responsável')),
  descricao text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_inc_env_empresa ON public.sgsst_incidentes_envolvidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inc_env_inc ON public.sgsst_incidentes_envolvidos(incidente_id);

ALTER TABLE public.sgsst_incidentes_envolvidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos;
CREATE POLICY "Users view own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos;
CREATE POLICY "Users insert own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos;
CREATE POLICY "Users update own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos;
CREATE POLICY "Users delete own empresa sgsst_incidentes_envolvidos" ON public.sgsst_incidentes_envolvidos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_incidentes_envolvidos ON public.sgsst_incidentes_envolvidos;
CREATE TRIGGER audit_sgsst_incidentes_envolvidos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_incidentes_envolvidos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_incidentes_investigacao
CREATE TABLE IF NOT EXISTS public.sgsst_incidentes_investigacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  incidente_id uuid NOT NULL REFERENCES public.sgsst_incidentes(id) ON DELETE CASCADE,
  descricao_investigacao text NOT NULL,
  fatos_observados text,
  causas_imediatas text,
  causas_basicas text,
  causas_raiz text,
  fatores_contribuintes text,
  conclusao text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_investigacao date DEFAULT CURRENT_DATE,
  risco_catalogo_id uuid REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_inc_inv_empresa ON public.sgsst_incidentes_investigacao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inc_inv_inc ON public.sgsst_incidentes_investigacao(incidente_id);

ALTER TABLE public.sgsst_incidentes_investigacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao;
CREATE POLICY "Users view own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao;
CREATE POLICY "Users insert own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao;
CREATE POLICY "Users update own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao;
CREATE POLICY "Users delete own empresa sgsst_incidentes_investigacao" ON public.sgsst_incidentes_investigacao
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_incidentes_investigacao ON public.sgsst_incidentes_investigacao;
CREATE TRIGGER audit_sgsst_incidentes_investigacao
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_incidentes_investigacao
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_incidentes_acoes
CREATE TABLE IF NOT EXISTS public.sgsst_incidentes_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  incidente_id uuid NOT NULL REFERENCES public.sgsst_incidentes(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'Corretiva' CHECK (tipo IN ('Corretiva', 'Preventiva', 'Contenção', 'Melhoria')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  prioridade text NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  data_conclusao date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_inc_aco_empresa ON public.sgsst_incidentes_acoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inc_aco_inc ON public.sgsst_incidentes_acoes(incidente_id);

ALTER TABLE public.sgsst_incidentes_acoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes;
CREATE POLICY "Users view own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes;
CREATE POLICY "Users insert own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes;
CREATE POLICY "Users update own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes;
CREATE POLICY "Users delete own empresa sgsst_incidentes_acoes" ON public.sgsst_incidentes_acoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_incidentes_acoes ON public.sgsst_incidentes_acoes;
CREATE TRIGGER audit_sgsst_incidentes_acoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_incidentes_acoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TABELA sgsst_incidentes_historico
CREATE TABLE IF NOT EXISTS public.sgsst_incidentes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  incidente_id uuid NOT NULL REFERENCES public.sgsst_incidentes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_inc_hist_empresa ON public.sgsst_incidentes_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inc_hist_inc ON public.sgsst_incidentes_historico(incidente_id);

ALTER TABLE public.sgsst_incidentes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_incidentes_historico" ON public.sgsst_incidentes_historico;
CREATE POLICY "Users view own empresa sgsst_incidentes_historico" ON public.sgsst_incidentes_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_incidentes_historico" ON public.sgsst_incidentes_historico;
CREATE POLICY "Users insert own empresa sgsst_incidentes_historico" ON public.sgsst_incidentes_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_incidentes_historico ON public.sgsst_incidentes_historico;
CREATE TRIGGER audit_sgsst_incidentes_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_incidentes_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 6. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_incidentes_tenant_integrity()
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

DROP TRIGGER IF EXISTS trg_sgsst_incidentes_tenant_check ON public.sgsst_incidentes;
CREATE TRIGGER trg_sgsst_incidentes_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_incidentes
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_incidentes_tenant_integrity();
