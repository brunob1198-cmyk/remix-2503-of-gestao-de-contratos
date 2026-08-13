-- Migration: Create SGSST Core Tables (Funções e Dados Complementares do Colaborador)

-- 1. TABELA sgsst_funcoes
CREATE TABLE IF NOT EXISTS public.sgsst_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  cbo text,
  descricao text,
  requisitos_minimos text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para sgsst_funcoes
CREATE INDEX IF NOT EXISTS idx_sgsst_funcoes_empresa ON public.sgsst_funcoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_funcoes_status ON public.sgsst_funcoes(empresa_id, status);

-- RLS para sgsst_funcoes
ALTER TABLE public.sgsst_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_funcoes" ON public.sgsst_funcoes;
CREATE POLICY "Users view own empresa sgsst_funcoes" ON public.sgsst_funcoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_funcoes" ON public.sgsst_funcoes;
CREATE POLICY "Users insert own empresa sgsst_funcoes" ON public.sgsst_funcoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_funcoes" ON public.sgsst_funcoes;
CREATE POLICY "Users update own empresa sgsst_funcoes" ON public.sgsst_funcoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_funcoes" ON public.sgsst_funcoes;
CREATE POLICY "Users delete own empresa sgsst_funcoes" ON public.sgsst_funcoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Auditoria
DROP TRIGGER IF EXISTS audit_sgsst_funcoes ON public.sgsst_funcoes;
CREATE TRIGGER audit_sgsst_funcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_funcoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_colaborador_dados
CREATE TABLE IF NOT EXISTS public.sgsst_colaborador_dados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recurso_id uuid REFERENCES public.recursos(id) ON DELETE RESTRICT,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE RESTRICT,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  matricula text,
  data_admissao date,
  data_demissao date,
  tipo_vinculo text NOT NULL DEFAULT 'CLT' CHECK (tipo_vinculo IN ('CLT', 'PJ', 'Terceirizado', 'Estagiario', 'Outro')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'afastado', 'desligado')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sgsst_colaborador_ref CHECK (profile_id IS NOT NULL OR recurso_id IS NOT NULL OR matricula IS NOT NULL)
);

-- Índices Únicos e de Busca para sgsst_colaborador_dados
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_colab_empresa_profile
  ON public.sgsst_colaborador_dados(empresa_id, profile_id) WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_colab_empresa_recurso
  ON public.sgsst_colaborador_dados(empresa_id, recurso_id) WHERE recurso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_colab_empresa ON public.sgsst_colaborador_dados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_funcao ON public.sgsst_colaborador_dados(funcao_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_area ON public.sgsst_colaborador_dados(area_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_status ON public.sgsst_colaborador_dados(empresa_id, status);

-- RLS para sgsst_colaborador_dados
ALTER TABLE public.sgsst_colaborador_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados;
CREATE POLICY "Users view own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados;
CREATE POLICY "Users insert own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados;
CREATE POLICY "Users update own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados;
CREATE POLICY "Users delete own empresa sgsst_colaborador_dados" ON public.sgsst_colaborador_dados
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Auditoria
DROP TRIGGER IF EXISTS audit_sgsst_colaborador_dados ON public.sgsst_colaborador_dados;
CREATE TRIGGER audit_sgsst_colaborador_dados
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_colaborador_dados
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger de Validação da Integridade do Tenant
CREATE OR REPLACE FUNCTION public.check_sgsst_colaborador_tenant_integrity()
RETURNS trigger AS $$
BEGIN
  IF NEW.funcao_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_funcoes
      WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
    END IF;
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.areas
      WHERE id = NEW.area_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O setor/área informado não pertence à mesma empresa.';
    END IF;
  END IF;

  IF NEW.profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.profile_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O perfil informado não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_colaborador_tenant_check ON public.sgsst_colaborador_dados;
CREATE TRIGGER trg_sgsst_colaborador_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_colaborador_dados
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_colaborador_tenant_integrity();
