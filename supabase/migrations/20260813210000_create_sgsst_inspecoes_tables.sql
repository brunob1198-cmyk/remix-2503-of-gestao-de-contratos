-- Migration: Create SGSST Inspeções, Itens de Checklist, Não Conformidades e Histórico

-- 1. TABELA sgsst_inspecoes
CREATE TABLE IF NOT EXISTS public.sgsst_inspecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Inspeção de Segurança', 'Inspeção de Área', 'Inspeção de Equipamento', 'Inspeção de EPI', 'Inspeção de Trabalho', 'Inspeção de Obra', 'Inspeção Comportamental', 'Outros')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_planejada date NOT NULL DEFAULT CURRENT_DATE,
  data_execucao timestamptz,
  status text NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA')),
  observacoes text,
  pgr_id uuid REFERENCES public.sgsst_pgr(id) ON DELETE SET NULL,
  apr_id uuid REFERENCES public.sgsst_apr(id) ON DELETE SET NULL,
  pt_id uuid REFERENCES public.sgsst_pt(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices e Unicidade por Empresa para sgsst_inspecoes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_insp_empresa_codigo
  ON public.sgsst_inspecoes(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_insp_empresa ON public.sgsst_inspecoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_projeto ON public.sgsst_inspecoes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_site ON public.sgsst_inspecoes(site_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_status ON public.sgsst_inspecoes(empresa_id, status);

-- RLS para sgsst_inspecoes
ALTER TABLE public.sgsst_inspecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_inspecoes" ON public.sgsst_inspecoes;
CREATE POLICY "Users view own empresa sgsst_inspecoes" ON public.sgsst_inspecoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_inspecoes" ON public.sgsst_inspecoes;
CREATE POLICY "Users insert own empresa sgsst_inspecoes" ON public.sgsst_inspecoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_inspecoes" ON public.sgsst_inspecoes;
CREATE POLICY "Users update own empresa sgsst_inspecoes" ON public.sgsst_inspecoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_inspecoes" ON public.sgsst_inspecoes;
CREATE POLICY "Users delete own empresa sgsst_inspecoes" ON public.sgsst_inspecoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_inspecoes
DROP TRIGGER IF EXISTS audit_sgsst_inspecoes ON public.sgsst_inspecoes;
CREATE TRIGGER audit_sgsst_inspecoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_inspecoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_inspecoes_itens
CREATE TABLE IF NOT EXISTS public.sgsst_inspecoes_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inspecao_id uuid NOT NULL REFERENCES public.sgsst_inspecoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  categoria text,
  obrigatorio boolean DEFAULT true,
  resposta text NOT NULL DEFAULT 'PENDENTE' CHECK (resposta IN ('CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL', 'PENDENTE')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_insp_itens_empresa ON public.sgsst_inspecoes_itens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_itens_insp ON public.sgsst_inspecoes_itens(inspecao_id);

ALTER TABLE public.sgsst_inspecoes_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens;
CREATE POLICY "Users view own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens;
CREATE POLICY "Users insert own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens;
CREATE POLICY "Users update own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens;
CREATE POLICY "Users delete own empresa sgsst_inspecoes_itens" ON public.sgsst_inspecoes_itens
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_inspecoes_itens ON public.sgsst_inspecoes_itens;
CREATE TRIGGER audit_sgsst_inspecoes_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_inspecoes_itens
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_inspecoes_nao_conformidades
CREATE TABLE IF NOT EXISTS public.sgsst_inspecoes_nao_conformidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inspecao_id uuid NOT NULL REFERENCES public.sgsst_inspecoes(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.sgsst_inspecoes_itens(id) ON DELETE CASCADE,
  risco_catalogo_id uuid REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  evidencia text,
  criticidade text NOT NULL DEFAULT 'MEDIA' CHECK (criticidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_TRATAMENTO', 'CONCLUIDA', 'CANCELADA')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_insp_nc_empresa ON public.sgsst_inspecoes_nao_conformidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_nc_insp ON public.sgsst_inspecoes_nao_conformidades(inspecao_id);

ALTER TABLE public.sgsst_inspecoes_nao_conformidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades;
CREATE POLICY "Users view own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades;
CREATE POLICY "Users insert own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades;
CREATE POLICY "Users update own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades;
CREATE POLICY "Users delete own empresa sgsst_inspecoes_nao_conformidades" ON public.sgsst_inspecoes_nao_conformidades
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_inspecoes_nao_conformidades ON public.sgsst_inspecoes_nao_conformidades;
CREATE TRIGGER audit_sgsst_inspecoes_nao_conformidades
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_inspecoes_nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_inspecoes_historico
CREATE TABLE IF NOT EXISTS public.sgsst_inspecoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inspecao_id uuid NOT NULL REFERENCES public.sgsst_inspecoes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status_anterior text,
  novo_status text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_insp_hist_empresa ON public.sgsst_inspecoes_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_insp_hist_insp ON public.sgsst_inspecoes_historico(inspecao_id);

ALTER TABLE public.sgsst_inspecoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_inspecoes_historico" ON public.sgsst_inspecoes_historico;
CREATE POLICY "Users view own empresa sgsst_inspecoes_historico" ON public.sgsst_inspecoes_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_inspecoes_historico" ON public.sgsst_inspecoes_historico;
CREATE POLICY "Users insert own empresa sgsst_inspecoes_historico" ON public.sgsst_inspecoes_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_inspecoes_historico ON public.sgsst_inspecoes_historico;
CREATE TRIGGER audit_sgsst_inspecoes_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_inspecoes_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_inspecoes_tenant_integrity()
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

DROP TRIGGER IF EXISTS trg_sgsst_inspecoes_tenant_check ON public.sgsst_inspecoes;
CREATE TRIGGER trg_sgsst_inspecoes_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_inspecoes
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_inspecoes_tenant_integrity();
