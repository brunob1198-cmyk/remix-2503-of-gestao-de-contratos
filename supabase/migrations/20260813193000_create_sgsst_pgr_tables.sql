-- Migration: Create SGSST PGR, Inventário de Riscos e Medidas de Controle

-- 1. TABELA sgsst_pgr
CREATE TABLE IF NOT EXISTS public.sgsst_pgr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  objetivo text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_revisao date,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'ATIVO', 'EM_REVISAO', 'ENCERRADO')),
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices e Unicidade por Empresa para sgsst_pgr
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_pgr_empresa_codigo
  ON public.sgsst_pgr(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_empresa ON public.sgsst_pgr(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_projeto ON public.sgsst_pgr(projeto_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_site ON public.sgsst_pgr(site_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_status ON public.sgsst_pgr(empresa_id, status);

-- RLS para sgsst_pgr
ALTER TABLE public.sgsst_pgr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr" ON public.sgsst_pgr;
CREATE POLICY "Users view own empresa sgsst_pgr" ON public.sgsst_pgr
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr" ON public.sgsst_pgr;
CREATE POLICY "Users insert own empresa sgsst_pgr" ON public.sgsst_pgr
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pgr" ON public.sgsst_pgr;
CREATE POLICY "Users update own empresa sgsst_pgr" ON public.sgsst_pgr
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pgr" ON public.sgsst_pgr;
CREATE POLICY "Users delete own empresa sgsst_pgr" ON public.sgsst_pgr
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_pgr
DROP TRIGGER IF EXISTS audit_sgsst_pgr ON public.sgsst_pgr;
CREATE TRIGGER audit_sgsst_pgr
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pgr
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_pgr_inventario
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pgr_id uuid NOT NULL REFERENCES public.sgsst_pgr(id) ON DELETE CASCADE,
  risco_catalogo_id uuid REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  atividade text NOT NULL,
  perigo text NOT NULL,
  fonte_geradora text,
  consequencia text,
  trabalhadores_expostos integer DEFAULT 1,
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
  medidas_existentes text,
  medidas_necessarias text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para sgsst_pgr_inventario
CREATE INDEX IF NOT EXISTS idx_sgsst_inventario_empresa ON public.sgsst_pgr_inventario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inventario_pgr ON public.sgsst_pgr_inventario(pgr_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inventario_risco ON public.sgsst_pgr_inventario(risco_catalogo_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_inventario_area ON public.sgsst_pgr_inventario(area_id);

-- RLS para sgsst_pgr_inventario
ALTER TABLE public.sgsst_pgr_inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario;
CREATE POLICY "Users view own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario;
CREATE POLICY "Users insert own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario;
CREATE POLICY "Users update own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario;
CREATE POLICY "Users delete own empresa sgsst_pgr_inventario" ON public.sgsst_pgr_inventario
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_pgr_inventario
DROP TRIGGER IF EXISTS audit_sgsst_pgr_inventario ON public.sgsst_pgr_inventario;
CREATE TRIGGER audit_sgsst_pgr_inventario
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pgr_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_pgr_medidas_controle
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_medidas_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL REFERENCES public.sgsst_pgr_inventario(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Eliminação', 'Substituição', 'Engenharia', 'Administrativa', 'EPI')),
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'implementado', 'cancelado')),
  data_implementacao date,
  observacao text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para sgsst_pgr_medidas_controle
CREATE INDEX IF NOT EXISTS idx_sgsst_medidas_empresa ON public.sgsst_pgr_medidas_controle(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_medidas_inventario ON public.sgsst_pgr_medidas_controle(inventario_id);

-- RLS para sgsst_pgr_medidas_controle
ALTER TABLE public.sgsst_pgr_medidas_controle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle;
CREATE POLICY "Users view own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle;
CREATE POLICY "Users insert own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle;
CREATE POLICY "Users update own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle;
CREATE POLICY "Users delete own empresa sgsst_pgr_medidas_controle" ON public.sgsst_pgr_medidas_controle
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger de Auditoria para sgsst_pgr_medidas_controle
DROP TRIGGER IF EXISTS audit_sgsst_pgr_medidas_controle ON public.sgsst_pgr_medidas_controle;
CREATE TRIGGER audit_sgsst_pgr_medidas_controle
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pgr_medidas_controle
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_pgr_tenant_integrity()
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

  IF NEW.site_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sites s
      JOIN public.projetos p ON s.projeto_id = p.id
      WHERE s.id = NEW.site_id AND p.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O canteiro/site informado não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_pgr_tenant_check ON public.sgsst_pgr;
CREATE TRIGGER trg_sgsst_pgr_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pgr
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_pgr_tenant_integrity();
