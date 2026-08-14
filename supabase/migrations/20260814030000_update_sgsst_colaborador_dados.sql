-- Migration: Upgrade sgsst_colaborador_dados and create sgsst_colaborador_treinamentos
-- Uncoupling Colaboradores from compulsory 'recursos' dependency and adding full worker dossier fields

-- 1. ADD COLUMNS TO sgsst_colaborador_dados
ALTER TABLE public.sgsst_colaborador_dados
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS foto_r2_key text,
  ADD COLUMN IF NOT EXISTS tamanho_calcado text,
  ADD COLUMN IF NOT EXISTS tamanho_camisa text,
  ADD COLUMN IF NOT EXISTS tamanho_calca text,
  ADD COLUMN IF NOT EXISTS cnh_numero text,
  ADD COLUMN IF NOT EXISTS cnh_categoria text,
  ADD COLUMN IF NOT EXISTS cnh_validade date,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;

-- Drop obsolete CHECK constraint if present
ALTER TABLE public.sgsst_colaborador_dados
  DROP CONSTRAINT IF EXISTS chk_sgsst_colaborador_ref;

-- Add updated CHECK constraint requiring either nome, profile_id, or recurso_id
ALTER TABLE public.sgsst_colaborador_dados
  ADD CONSTRAINT chk_sgsst_colaborador_ref CHECK (nome IS NOT NULL OR profile_id IS NOT NULL OR recurso_id IS NOT NULL OR matricula IS NOT NULL);

-- Index for searching colaboradores by name and CPF
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_nome ON public.sgsst_colaborador_dados(empresa_id, nome);
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_cpf ON public.sgsst_colaborador_dados(empresa_id, cpf);

-- 2. CREATE TABLE sgsst_colaborador_treinamentos (Certificados & NRs por Colaborador)
CREATE TABLE IF NOT EXISTS public.sgsst_colaborador_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  colaborador_id uuid NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  treinamento_id uuid REFERENCES public.sgsst_treinamentos(id) ON DELETE SET NULL,
  nome_treinamento text NOT NULL,
  carga_horaria integer,
  data_conclusao date,
  data_validade date,
  certificado_url text,
  certificado_r2_key text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for sgsst_colaborador_treinamentos
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_tr_empresa ON public.sgsst_colaborador_treinamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_colab_tr_colab ON public.sgsst_colaborador_treinamentos(colaborador_id);

-- RLS for sgsst_colaborador_treinamentos
ALTER TABLE public.sgsst_colaborador_treinamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos;
CREATE POLICY "Users view own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos;
CREATE POLICY "Users insert own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos;
CREATE POLICY "Users update own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos;
CREATE POLICY "Users delete own sgsst_colaborador_treinamentos" ON public.sgsst_colaborador_treinamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Trigger audit for sgsst_colaborador_treinamentos
DROP TRIGGER IF EXISTS audit_sgsst_colaborador_treinamentos ON public.sgsst_colaborador_treinamentos;
CREATE TRIGGER audit_sgsst_colaborador_treinamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_colaborador_treinamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
