-- Migration: Create SGSST APR (Análise Preliminar de Riscos), Etapas, Riscos, Medidas, Participantes e Histórico de Aprovação

-- 1. TABELA sgsst_apr
CREATE TABLE IF NOT EXISTS public.sgsst_apr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  atividade text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  validade date,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'CANCELADA', 'ENCERRADA')),
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices e Unicidade por Empresa para sgsst_apr
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_apr_empresa_codigo
  ON public.sgsst_apr(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_empresa ON public.sgsst_apr(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_projeto ON public.sgsst_apr(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_site ON public.sgsst_apr(site_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_status ON public.sgsst_apr(empresa_id, status);

-- RLS para sgsst_apr
ALTER TABLE public.sgsst_apr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr" ON public.sgsst_apr;
CREATE POLICY "Users view own empresa sgsst_apr" ON public.sgsst_apr
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr" ON public.sgsst_apr;
CREATE POLICY "Users insert own empresa sgsst_apr" ON public.sgsst_apr
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_apr" ON public.sgsst_apr;
CREATE POLICY "Users update own empresa sgsst_apr" ON public.sgsst_apr
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_apr" ON public.sgsst_apr;
CREATE POLICY "Users delete own empresa sgsst_apr" ON public.sgsst_apr
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_apr
DROP TRIGGER IF EXISTS audit_sgsst_apr ON public.sgsst_apr;
CREATE TRIGGER audit_sgsst_apr
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_apr_etapas
CREATE TABLE IF NOT EXISTS public.sgsst_apr_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  apr_id uuid NOT NULL REFERENCES public.sgsst_apr(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_etapas_empresa ON public.sgsst_apr_etapas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_etapas_apr ON public.sgsst_apr_etapas(apr_id);

ALTER TABLE public.sgsst_apr_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas;
CREATE POLICY "Users view own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas;
CREATE POLICY "Users insert own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas;
CREATE POLICY "Users update own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas;
CREATE POLICY "Users delete own empresa sgsst_apr_etapas" ON public.sgsst_apr_etapas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_apr_etapas ON public.sgsst_apr_etapas;
CREATE TRIGGER audit_sgsst_apr_etapas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr_etapas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_apr_riscos
CREATE TABLE IF NOT EXISTS public.sgsst_apr_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  etapa_id uuid NOT NULL REFERENCES public.sgsst_apr_etapas(id) ON DELETE CASCADE,
  risco_catalogo_id uuid REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE SET NULL,
  perigo text NOT NULL,
  risco text NOT NULL,
  consequencia text,
  probabilidade integer NOT NULL CHECK (probabilidade BETWEEN 1 AND 5),
  severidade integer NOT NULL CHECK (severidade BETWEEN 1 AND 5),
  nivel_risco integer GENERATED ALWAYS AS (probabilidade * severidade) STORED,
  classificacao text GENERATED ALWAYS AS (
    CASE 
      WHEN (probabilidade * severidade) <= 4 THEN 'BAIXO'
      WHEN (probabilidade * severidade) <= 9 THEN 'MODERADO'
      WHEN (probabilidade * severidade) <= 16 THEN 'ALTO'
      ELSE 'CRÍTICO'
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_riscos_empresa ON public.sgsst_apr_riscos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_riscos_etapa ON public.sgsst_apr_riscos(etapa_id);

ALTER TABLE public.sgsst_apr_riscos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos;
CREATE POLICY "Users view own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos;
CREATE POLICY "Users insert own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos;
CREATE POLICY "Users update own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos;
CREATE POLICY "Users delete own empresa sgsst_apr_riscos" ON public.sgsst_apr_riscos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_apr_riscos ON public.sgsst_apr_riscos;
CREATE TRIGGER audit_sgsst_apr_riscos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr_riscos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_apr_medidas
CREATE TABLE IF NOT EXISTS public.sgsst_apr_medidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  apr_risco_id uuid NOT NULL REFERENCES public.sgsst_apr_riscos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Eliminação', 'Substituição', 'Engenharia', 'Administrativa', 'EPI')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'implementado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_medidas_empresa ON public.sgsst_apr_medidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_medidas_risco ON public.sgsst_apr_medidas(apr_risco_id);

ALTER TABLE public.sgsst_apr_medidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas;
CREATE POLICY "Users view own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas;
CREATE POLICY "Users insert own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas;
CREATE POLICY "Users update own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas;
CREATE POLICY "Users delete own empresa sgsst_apr_medidas" ON public.sgsst_apr_medidas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_apr_medidas ON public.sgsst_apr_medidas;
CREATE TRIGGER audit_sgsst_apr_medidas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr_medidas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TABELA sgsst_apr_participantes
CREATE TABLE IF NOT EXISTS public.sgsst_apr_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  apr_id uuid NOT NULL REFERENCES public.sgsst_apr(id) ON DELETE CASCADE,
  colaborador_dados_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  participacao text DEFAULT 'Executante',
  confirmacao boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_part_empresa ON public.sgsst_apr_participantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_part_apr ON public.sgsst_apr_participantes(apr_id);

ALTER TABLE public.sgsst_apr_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes;
CREATE POLICY "Users view own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes;
CREATE POLICY "Users insert own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes;
CREATE POLICY "Users update own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes;
CREATE POLICY "Users delete own empresa sgsst_apr_participantes" ON public.sgsst_apr_participantes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_apr_participantes ON public.sgsst_apr_participantes;
CREATE TRIGGER audit_sgsst_apr_participantes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr_participantes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 6. TABELA sgsst_apr_historico (Histórico de Aprovações/Rejeições)
CREATE TABLE IF NOT EXISTS public.sgsst_apr_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  apr_id uuid NOT NULL REFERENCES public.sgsst_apr(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_apr_hist_empresa ON public.sgsst_apr_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_hist_apr ON public.sgsst_apr_historico(apr_id);

ALTER TABLE public.sgsst_apr_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_apr_historico" ON public.sgsst_apr_historico;
CREATE POLICY "Users view own empresa sgsst_apr_historico" ON public.sgsst_apr_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_apr_historico" ON public.sgsst_apr_historico;
CREATE POLICY "Users insert own empresa sgsst_apr_historico" ON public.sgsst_apr_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_apr_historico ON public.sgsst_apr_historico;
CREATE TRIGGER audit_sgsst_apr_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_apr_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 7. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_apr_tenant_integrity()
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

DROP TRIGGER IF EXISTS trg_sgsst_apr_tenant_check ON public.sgsst_apr;
CREATE TRIGGER trg_sgsst_apr_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_apr
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_apr_tenant_integrity();
