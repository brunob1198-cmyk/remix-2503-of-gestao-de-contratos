-- Migration: Create SGSST Catálogo de Riscos Table (sgsst_riscos_catalogo)

CREATE TABLE IF NOT EXISTS public.sgsst_riscos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text,
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('Físico', 'Químico', 'Biológico', 'Ergonômico', 'Acidente', 'Outros')),
  descricao text,
  agente text,
  fonte_geradora text,
  consequencia text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices e Unicidade por Empresa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_riscos_empresa_codigo
  ON public.sgsst_riscos_catalogo(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_riscos_empresa ON public.sgsst_riscos_catalogo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_riscos_categoria ON public.sgsst_riscos_catalogo(empresa_id, categoria);
CREATE INDEX IF NOT EXISTS idx_sgsst_riscos_status ON public.sgsst_riscos_catalogo(empresa_id, status);

-- RLS para sgsst_riscos_catalogo
ALTER TABLE public.sgsst_riscos_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo;
CREATE POLICY "Users view own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo;
CREATE POLICY "Users insert own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo;
CREATE POLICY "Users update own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo;
CREATE POLICY "Users delete own empresa sgsst_riscos_catalogo" ON public.sgsst_riscos_catalogo
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria
DROP TRIGGER IF EXISTS audit_sgsst_riscos_catalogo ON public.sgsst_riscos_catalogo;
CREATE TRIGGER audit_sgsst_riscos_catalogo
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_riscos_catalogo
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
