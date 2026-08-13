-- Migration: Create SGSST Permissão de Trabalho (PT), Riscos, Medidas, Checklist, Participantes e Histórico

-- 1. TABELA sgsst_pt
CREATE TABLE IF NOT EXISTS public.sgsst_pt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  apr_id uuid REFERENCES public.sgsst_apr(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Trabalho a Quente', 'Trabalho em Altura', 'Espaço Confinado', 'Trabalho com Eletricidade', 'Escavação', 'Içamento', 'Trabalho com Produtos Químicos', 'Outros')),
  atividade text NOT NULL,
  local_execucao text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  observacoes text,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'EM_ANALISE', 'APROVADA', 'EM_EXECUCAO', 'SUSPENSA', 'ENCERRADA', 'CANCELADA', 'REJEITADA')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices e Unicidade por Empresa para sgsst_pt
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_pt_empresa_codigo
  ON public.sgsst_pt(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_empresa ON public.sgsst_pt(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_projeto ON public.sgsst_pt(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_site ON public.sgsst_pt(site_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_apr ON public.sgsst_pt(apr_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_status ON public.sgsst_pt(empresa_id, status);

-- RLS para sgsst_pt
ALTER TABLE public.sgsst_pt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt" ON public.sgsst_pt;
CREATE POLICY "Users view own empresa sgsst_pt" ON public.sgsst_pt
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt" ON public.sgsst_pt;
CREATE POLICY "Users insert own empresa sgsst_pt" ON public.sgsst_pt
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt" ON public.sgsst_pt;
CREATE POLICY "Users update own empresa sgsst_pt" ON public.sgsst_pt
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt" ON public.sgsst_pt;
CREATE POLICY "Users delete own empresa sgsst_pt" ON public.sgsst_pt
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_pt
DROP TRIGGER IF EXISTS audit_sgsst_pt ON public.sgsst_pt;
CREATE TRIGGER audit_sgsst_pt
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_pt_riscos
CREATE TABLE IF NOT EXISTS public.sgsst_pt_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_id uuid NOT NULL REFERENCES public.sgsst_pt(id) ON DELETE CASCADE,
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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_riscos_empresa ON public.sgsst_pt_riscos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_riscos_pt ON public.sgsst_pt_riscos(pt_id);

ALTER TABLE public.sgsst_pt_riscos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos;
CREATE POLICY "Users view own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos;
CREATE POLICY "Users insert own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos;
CREATE POLICY "Users update own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos;
CREATE POLICY "Users delete own empresa sgsst_pt_riscos" ON public.sgsst_pt_riscos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_riscos ON public.sgsst_pt_riscos;
CREATE TRIGGER audit_sgsst_pt_riscos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_riscos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_pt_medidas
CREATE TABLE IF NOT EXISTS public.sgsst_pt_medidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_risco_id uuid NOT NULL REFERENCES public.sgsst_pt_riscos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Eliminação', 'Substituição', 'Engenharia', 'Administrativa', 'EPI')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'implementado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_medidas_empresa ON public.sgsst_pt_medidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_medidas_risco ON public.sgsst_pt_medidas(pt_risco_id);

ALTER TABLE public.sgsst_pt_medidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas;
CREATE POLICY "Users view own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas;
CREATE POLICY "Users insert own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas;
CREATE POLICY "Users update own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas;
CREATE POLICY "Users delete own empresa sgsst_pt_medidas" ON public.sgsst_pt_medidas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_medidas ON public.sgsst_pt_medidas;
CREATE TRIGGER audit_sgsst_pt_medidas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_medidas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_pt_checklist
CREATE TABLE IF NOT EXISTS public.sgsst_pt_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_id uuid NOT NULL REFERENCES public.sgsst_pt(id) ON DELETE CASCADE,
  item text NOT NULL,
  obrigatorio boolean DEFAULT true,
  resposta text NOT NULL DEFAULT 'Pendente' CHECK (resposta IN ('Conforme', 'Não Conforme', 'Não Aplicável', 'Pendente')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_chk_empresa ON public.sgsst_pt_checklist(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_chk_pt ON public.sgsst_pt_checklist(pt_id);

ALTER TABLE public.sgsst_pt_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist;
CREATE POLICY "Users view own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist;
CREATE POLICY "Users insert own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist;
CREATE POLICY "Users update own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist;
CREATE POLICY "Users delete own empresa sgsst_pt_checklist" ON public.sgsst_pt_checklist
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_checklist ON public.sgsst_pt_checklist;
CREATE TRIGGER audit_sgsst_pt_checklist
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_checklist
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TABELA sgsst_pt_participantes
CREATE TABLE IF NOT EXISTS public.sgsst_pt_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_id uuid NOT NULL REFERENCES public.sgsst_pt(id) ON DELETE CASCADE,
  colaborador_dados_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  responsabilidade text DEFAULT 'Executante',
  confirmacao boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_part_empresa ON public.sgsst_pt_participantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_part_pt ON public.sgsst_pt_participantes(pt_id);

ALTER TABLE public.sgsst_pt_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes;
CREATE POLICY "Users view own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes;
CREATE POLICY "Users insert own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes;
CREATE POLICY "Users update own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes;
CREATE POLICY "Users delete own empresa sgsst_pt_participantes" ON public.sgsst_pt_participantes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_participantes ON public.sgsst_pt_participantes;
CREATE TRIGGER audit_sgsst_pt_participantes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_participantes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 6. TABELA sgsst_pt_historico
CREATE TABLE IF NOT EXISTS public.sgsst_pt_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_id uuid NOT NULL REFERENCES public.sgsst_pt(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_hist_empresa ON public.sgsst_pt_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_hist_pt ON public.sgsst_pt_historico(pt_id);

ALTER TABLE public.sgsst_pt_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_historico" ON public.sgsst_pt_historico;
CREATE POLICY "Users view own empresa sgsst_pt_historico" ON public.sgsst_pt_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_historico" ON public.sgsst_pt_historico;
CREATE POLICY "Users insert own empresa sgsst_pt_historico" ON public.sgsst_pt_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_historico ON public.sgsst_pt_historico;
CREATE TRIGGER audit_sgsst_pt_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 7. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_pt_tenant_integrity()
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

  IF NEW.apr_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_apr
      WHERE id = NEW.apr_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: A APR informada não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_pt_tenant_check ON public.sgsst_pt;
CREATE TRIGGER trg_sgsst_pt_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pt
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_pt_tenant_integrity();
