-- Migration: Create SGSST Documentos, Versões e Histórico com metadados R2

-- 1. TABELA sgsst_documentos
CREATE TABLE IF NOT EXISTS public.sgsst_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL CHECK (categoria IN ('PGR', 'APR', 'PT', 'INSPECAO', 'INCIDENTE', 'NAO_CONFORMIDADE', 'PCMSO', 'ASO', 'TREINAMENTO', 'EPI', 'OUTROS')),
  tipo_mime text NOT NULL,
  tamanho bigint NOT NULL,
  r2_key text NOT NULL,
  r2_url text NOT NULL,
  entidade_tipo text CHECK (entidade_tipo IN ('PGR', 'APR', 'PT', 'INSPECAO', 'INCIDENTE', 'NAO_CONFORMIDADE', 'PCMSO', 'ASO', 'TREINAMENTO', 'EPI', 'OUTROS')),
  entidade_id uuid,
  versao_atual integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'ARQUIVADO', 'CANCELADO')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_doc_empresa ON public.sgsst_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_doc_cat ON public.sgsst_documentos(empresa_id, categoria);
CREATE INDEX IF NOT EXISTS idx_sgsst_doc_entidade ON public.sgsst_documentos(empresa_id, entidade_tipo, entidade_id);

ALTER TABLE public.sgsst_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_documentos" ON public.sgsst_documentos;
CREATE POLICY "Users view own empresa sgsst_documentos" ON public.sgsst_documentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_documentos" ON public.sgsst_documentos;
CREATE POLICY "Users insert own empresa sgsst_documentos" ON public.sgsst_documentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_documentos" ON public.sgsst_documentos;
CREATE POLICY "Users update own empresa sgsst_documentos" ON public.sgsst_documentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_documentos" ON public.sgsst_documentos;
CREATE POLICY "Users delete own empresa sgsst_documentos" ON public.sgsst_documentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_documentos ON public.sgsst_documentos;
CREATE TRIGGER audit_sgsst_documentos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_documentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_documentos_versoes
CREATE TABLE IF NOT EXISTS public.sgsst_documentos_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  documento_id uuid NOT NULL REFERENCES public.sgsst_documentos(id) ON DELETE CASCADE,
  numero_versao integer NOT NULL,
  r2_key text NOT NULL,
  r2_url text NOT NULL,
  tamanho bigint NOT NULL,
  tipo_mime text NOT NULL,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_doc_vers_empresa ON public.sgsst_documentos_versoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_doc_vers_doc ON public.sgsst_documentos_versoes(documento_id);

ALTER TABLE public.sgsst_documentos_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_documentos_versoes" ON public.sgsst_documentos_versoes;
CREATE POLICY "Users view own empresa sgsst_documentos_versoes" ON public.sgsst_documentos_versoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_documentos_versoes" ON public.sgsst_documentos_versoes;
CREATE POLICY "Users insert own empresa sgsst_documentos_versoes" ON public.sgsst_documentos_versoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_documentos_versoes ON public.sgsst_documentos_versoes;
CREATE TRIGGER audit_sgsst_documentos_versoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_documentos_versoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_documentos_historico
CREATE TABLE IF NOT EXISTS public.sgsst_documentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  documento_id uuid REFERENCES public.sgsst_documentos(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_doc_hist_empresa ON public.sgsst_documentos_historico(empresa_id);

ALTER TABLE public.sgsst_documentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_documentos_historico" ON public.sgsst_documentos_historico;
CREATE POLICY "Users view own empresa sgsst_documentos_historico" ON public.sgsst_documentos_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_documentos_historico" ON public.sgsst_documentos_historico;
CREATE POLICY "Users insert own empresa sgsst_documentos_historico" ON public.sgsst_documentos_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_documentos_historico ON public.sgsst_documentos_historico;
CREATE TRIGGER audit_sgsst_documentos_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_documentos_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_documentos_tenant_integrity()
RETURNS trigger AS $$
BEGIN
  -- Impede gravação se a empresa não corresponder
  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id é obrigatório para documentos do SGSST.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_doc_tenant_check ON public.sgsst_documentos;
CREATE TRIGGER trg_sgsst_doc_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_documentos
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_documentos_tenant_integrity();
