-- Migration: Create SGSST Treinamentos, Turmas, Participantes e Histórico

-- 1. TABELA sgsst_treinamentos
CREATE TABLE IF NOT EXISTS public.sgsst_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL CHECK (categoria IN ('NR', 'Integração', 'Segurança', 'Saúde', 'Operacional', 'Comportamental', 'Outros')),
  carga_horaria integer NOT NULL DEFAULT 8,
  validade_meses integer DEFAULT 12,
  obrigatorio boolean NOT NULL DEFAULT false,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  observacoes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_tr_empresa_codigo
  ON public.sgsst_treinamentos(empresa_id, codigo) WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_tr_empresa ON public.sgsst_treinamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_cat ON public.sgsst_treinamentos(empresa_id, categoria);

ALTER TABLE public.sgsst_treinamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_treinamentos" ON public.sgsst_treinamentos;
CREATE POLICY "Users view own empresa sgsst_treinamentos" ON public.sgsst_treinamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_treinamentos" ON public.sgsst_treinamentos;
CREATE POLICY "Users insert own empresa sgsst_treinamentos" ON public.sgsst_treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_treinamentos" ON public.sgsst_treinamentos;
CREATE POLICY "Users update own empresa sgsst_treinamentos" ON public.sgsst_treinamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_treinamentos" ON public.sgsst_treinamentos;
CREATE POLICY "Users delete own empresa sgsst_treinamentos" ON public.sgsst_treinamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_treinamentos ON public.sgsst_treinamentos;
CREATE TRIGGER audit_sgsst_treinamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_treinamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. TABELA sgsst_treinamentos_turmas
CREATE TABLE IF NOT EXISTS public.sgsst_treinamentos_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  treinamento_id uuid NOT NULL REFERENCES public.sgsst_treinamentos(id) ON DELETE CASCADE,
  codigo_turma text,
  data_inicial date NOT NULL DEFAULT CURRENT_DATE,
  data_final date,
  carga_horaria integer,
  instrutor text,
  local text,
  modalidade text NOT NULL DEFAULT 'PRESENCIAL' CHECK (modalidade IN ('PRESENCIAL', 'ONLINE', 'HIBRIDO')),
  capacidade integer DEFAULT 30,
  status text NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_tr_turma_empresa ON public.sgsst_treinamentos_turmas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_turma_tr ON public.sgsst_treinamentos_turmas(treinamento_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_turma_status ON public.sgsst_treinamentos_turmas(empresa_id, status);

ALTER TABLE public.sgsst_treinamentos_turmas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas;
CREATE POLICY "Users view own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas;
CREATE POLICY "Users insert own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas;
CREATE POLICY "Users update own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas;
CREATE POLICY "Users delete own empresa sgsst_treinamentos_turmas" ON public.sgsst_treinamentos_turmas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_treinamentos_turmas ON public.sgsst_treinamentos_turmas;
CREATE TRIGGER audit_sgsst_treinamentos_turmas
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_treinamentos_turmas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. TABELA sgsst_treinamentos_participantes
CREATE TABLE IF NOT EXISTS public.sgsst_treinamentos_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  turma_id uuid NOT NULL REFERENCES public.sgsst_treinamentos_turmas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  presenca boolean NOT NULL DEFAULT false,
  percentual_presenca numeric(5,2) DEFAULT 100.00,
  resultado text NOT NULL DEFAULT 'PENDENTE' CHECK (resultado IN ('APROVADO', 'REPROVADO', 'PENDENTE')),
  aprovacao boolean DEFAULT false,
  data_conclusao date,
  validade date,
  certificado text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sgsst_tr_part_turma_colab
  ON public.sgsst_treinamentos_participantes(turma_id, colaborador_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_tr_part_empresa ON public.sgsst_treinamentos_participantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_part_colab ON public.sgsst_treinamentos_participantes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_part_validade ON public.sgsst_treinamentos_participantes(empresa_id, validade);

ALTER TABLE public.sgsst_treinamentos_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes;
CREATE POLICY "Users view own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes;
CREATE POLICY "Users insert own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes;
CREATE POLICY "Users update own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes;
CREATE POLICY "Users delete own empresa sgsst_treinamentos_participantes" ON public.sgsst_treinamentos_participantes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_treinamentos_participantes ON public.sgsst_treinamentos_participantes;
CREATE TRIGGER audit_sgsst_treinamentos_participantes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_treinamentos_participantes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 4. TABELA sgsst_treinamentos_historico
CREATE TABLE IF NOT EXISTS public.sgsst_treinamentos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  treinamento_id uuid REFERENCES public.sgsst_treinamentos(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.sgsst_treinamentos_turmas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgsst_tr_hist_empresa ON public.sgsst_treinamentos_historico(empresa_id);

ALTER TABLE public.sgsst_treinamentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_treinamentos_historico" ON public.sgsst_treinamentos_historico;
CREATE POLICY "Users view own empresa sgsst_treinamentos_historico" ON public.sgsst_treinamentos_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_treinamentos_historico" ON public.sgsst_treinamentos_historico;
CREATE POLICY "Users insert own empresa sgsst_treinamentos_historico" ON public.sgsst_treinamentos_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_treinamentos_historico ON public.sgsst_treinamentos_historico;
CREATE TRIGGER audit_sgsst_treinamentos_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_treinamentos_historico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 5. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE DE TENANT
CREATE OR REPLACE FUNCTION public.check_sgsst_treinamentos_tenant_integrity()
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

DROP TRIGGER IF EXISTS trg_sgsst_treinamentos_tenant_check ON public.sgsst_treinamentos;
CREATE TRIGGER trg_sgsst_treinamentos_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_treinamentos
  FOR EACH ROW EXECUTE FUNCTION check_sgsst_treinamentos_tenant_integrity();
