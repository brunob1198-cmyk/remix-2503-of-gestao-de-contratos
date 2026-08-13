-- Migration: Create SGSST EPIs (Equipamentos de Proteção Individual), Entregas, Devoluções e Histórico

-- 1. TABELA sgsst_epis
CREATE TABLE IF NOT EXISTS public.sgsst_epis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text,
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('Proteção da Cabeça', 'Proteção dos Olhos e Face', 'Proteção Auditiva', 'Proteção Respiratória', 'Proteção das Mãos', 'Proteção dos Pés', 'Proteção do Corpo', 'Proteção Contra Quedas', 'Outros')),
  fabricante text,
  modelo text,
  ca text NOT NULL,
  validade_ca date,
  unidade_medida text NOT NULL DEFAULT 'UN',
  estoque_atual integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  descricao text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_epi_empresa_codigo
  ON public.sgsst_epis(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_empresa ON public.sgsst_epis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_ca ON public.sgsst_epis(empresa_id, ca);
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_validade_ca ON public.sgsst_epis(empresa_id, validade_ca);

ALTER TABLE public.sgsst_epis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_epis" ON public.sgsst_epis;
CREATE POLICY "Users view own empresa sgsst_epis" ON public.sgsst_epis
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_epis" ON public.sgsst_epis;
CREATE POLICY "Users insert own empresa sgsst_epis" ON public.sgsst_epis
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_epis" ON public.sgsst_epis;
CREATE POLICY "Users update own empresa sgsst_epis" ON public.sgsst_epis
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_epis" ON public.sgsst_epis;
CREATE POLICY "Users delete own empresa sgsst_epis" ON public.sgsst_epis
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_epis ON public.sgsst_epis;
CREATE TRIGGER audit_sgsst_epis
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_epis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_epi_entregas
CREATE TABLE IF NOT EXISTS public.sgsst_epi_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id uuid NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.sgsst_epis(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1,
  data_entrega date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_entrega_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo text NOT NULL DEFAULT 'PRIMEIRA_ENTREGA' CHECK (motivo IN ('PRIMEIRA_ENTREGA', 'SUBSTITUICAO', 'PERDA', 'DANIFICADO', 'VENCIMENTO', 'OUTROS')),
  tamanho_modelo text,
  confirmacao_recebimento boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_ent_empresa ON public.sgsst_epi_entregas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_ent_colab ON public.sgsst_epi_entregas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_ent_epi ON public.sgsst_epi_entregas(epi_id);

ALTER TABLE public.sgsst_epi_entregas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas;
CREATE POLICY "Users view own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas;
CREATE POLICY "Users insert own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas;
CREATE POLICY "Users update own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas;
CREATE POLICY "Users delete own empresa sgsst_epi_entregas" ON public.sgsst_epi_entregas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_epi_entregas ON public.sgsst_epi_entregas;
CREATE TRIGGER audit_sgsst_epi_entregas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_epi_entregas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_epi_devolucoes
CREATE TABLE IF NOT EXISTS public.sgsst_epi_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  entrega_id uuid NOT NULL REFERENCES public.sgsst_epi_entregas(id) ON DELETE CASCADE,
  quantidade_devolvida integer NOT NULL DEFAULT 1,
  data_devolucao date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_devolucao_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo text,
  condicao_epi text NOT NULL DEFAULT 'BOM' CHECK (condicao_epi IN ('BOM', 'DANIFICADO', 'INUTILIZADO', 'VENCIDO')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_dev_empresa ON public.sgsst_epi_devolucoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_epi_dev_ent ON public.sgsst_epi_devolucoes(entrega_id);

ALTER TABLE public.sgsst_epi_devolucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes;
CREATE POLICY "Users view own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes;
CREATE POLICY "Users insert own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes;
CREATE POLICY "Users delete own empresa sgsst_epi_devolucoes" ON public.sgsst_epi_devolucoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_epi_devolucoes ON public.sgsst_epi_devolucoes;
CREATE TRIGGER audit_sgsst_epi_devolucoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_epi_devolucoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_epi_historico
CREATE TABLE IF NOT EXISTS public.sgsst_epi_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  epi_id uuid REFERENCES public.sgsst_epis(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  quantidade integer,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_epi_hist_empresa ON public.sgsst_epi_historico(empresa_id);

ALTER TABLE public.sgsst_epi_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_epi_historico" ON public.sgsst_epi_historico;
CREATE POLICY "Users view own empresa sgsst_epi_historico" ON public.sgsst_epi_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_epi_historico" ON public.sgsst_epi_historico;
CREATE POLICY "Users insert own empresa sgsst_epi_historico" ON public.sgsst_epi_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_epi_historico ON public.sgsst_epi_historico;
CREATE TRIGGER audit_sgsst_epi_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_epi_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_epi_tenant_integrity()
RETURNS trigger AS $$
BEGIN
  IF NEW.colaborador_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_colaborador_dados
      WHERE id = NEW.colaborador_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O colaborador informado não pertence à mesma empresa.';
    END IF;
  END IF;

  IF NEW.epi_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sgsst_epis
      WHERE id = NEW.epi_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação de Multitenancy: O EPI informado não pertence à mesma empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sgsst_epi_tenant_check ON public.sgsst_epi_entregas;
CREATE TRIGGER trg_sgsst_epi_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_epi_entregas
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_epi_tenant_integrity();
