-- Migration: campos obrigatorios do ASO pela NR-07 (Fase 2 do plano)
--
-- O ASO e o documento que sai da empresa e vai para a mao do trabalhador. A norma
-- lista os campos obrigatorios, e faltavam tres coisas:
--
--   1. Descricao dos perigos e fatores de risco — obrigatoria, sem campo nenhum.
--   2. Distincao entre medico COORDENADOR do PCMSO e medico EXAMINADOR. Havia um
--      unico par (medico_responsavel/crm_medico), usado como examinador. A norma
--      pede os dois, e frequentemente sao pessoas diferentes.
--   3. Identificacao da organizacao (nome e CNPJ) no momento da emissao. Ler de
--      `empresas` na hora de imprimir nao serve: se a empresa mudar de nome, os
--      ASOs antigos passariam a mostrar o nome novo, o que falseia o documento.
--
-- Decisao de escopo (caminho 1, aprovado pelo usuario em 20/08/2026): o ASO passa
-- a listar VARIOS exames, via tabela de ligacao, porque e assim que o documento
-- real funciona. O `exame_id` antigo permanece por compatibilidade e e migrado
-- para a nova tabela.

-- =====================================================================
-- 1. Campos novos no ASO
-- =====================================================================
ALTER TABLE public.sgsst_asos
  ADD COLUMN IF NOT EXISTS descricao_riscos text,
  ADD COLUMN IF NOT EXISTS medico_coordenador text,
  ADD COLUMN IF NOT EXISTS crm_coordenador text,
  -- Congelamento dos dados da organizacao na emissao.
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS empresa_cnpj text;

COMMENT ON COLUMN public.sgsst_asos.descricao_riscos IS
  'NR-07: descricao dos perigos ou fatores de risco a que o trabalhador esta exposto. Campo obrigatorio no ASO.';
COMMENT ON COLUMN public.sgsst_asos.medico_responsavel IS
  'Medico EXAMINADOR: quem realizou o exame e assina o ASO.';
COMMENT ON COLUMN public.sgsst_asos.crm_medico IS
  'CRM do medico examinador.';
COMMENT ON COLUMN public.sgsst_asos.medico_coordenador IS
  'Medico COORDENADOR do PCMSO. Pode ser pessoa diferente do examinador.';
COMMENT ON COLUMN public.sgsst_asos.empresa_nome IS
  'Nome da organizacao no momento da emissao. Congelado de proposito: o documento nao deve mudar se a empresa for renomeada depois.';

-- =====================================================================
-- 2. Tabela de ligacao ASO <-> exames
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_aso_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  aso_id uuid NOT NULL REFERENCES public.sgsst_asos(id) ON DELETE CASCADE,
  exame_id uuid NOT NULL REFERENCES public.sgsst_exames(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Um exame nao entra duas vezes no mesmo ASO.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_aso_exames
  ON public.sgsst_aso_exames(aso_id, exame_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_aso_ex_empresa ON public.sgsst_aso_exames(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_ex_aso ON public.sgsst_aso_exames(aso_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_aso_ex_exame ON public.sgsst_aso_exames(exame_id);

ALTER TABLE public.sgsst_aso_exames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_aso_exames" ON public.sgsst_aso_exames;
CREATE POLICY "Users view own empresa sgsst_aso_exames" ON public.sgsst_aso_exames
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_aso_exames" ON public.sgsst_aso_exames;
CREATE POLICY "Users insert own empresa sgsst_aso_exames" ON public.sgsst_aso_exames
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_aso_exames" ON public.sgsst_aso_exames;
CREATE POLICY "Users update own empresa sgsst_aso_exames" ON public.sgsst_aso_exames
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_aso_exames" ON public.sgsst_aso_exames;
CREATE POLICY "Users delete own empresa sgsst_aso_exames" ON public.sgsst_aso_exames
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_aso_exames ON public.sgsst_aso_exames;
CREATE TRIGGER audit_sgsst_aso_exames
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_aso_exames
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =====================================================================
-- 3. Integridade de tenant na ligacao
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_sgsst_aso_exames_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_asos
    WHERE id = NEW.aso_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O ASO informado não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_exames
    WHERE id = NEW.exame_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O exame informado não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_aso_exames_tenant_check ON public.sgsst_aso_exames;
CREATE TRIGGER trg_sgsst_aso_exames_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_aso_exames
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_aso_exames_tenant_integrity();

-- =====================================================================
-- 4. Migra o vinculo antigo de exame unico para a tabela de ligacao
-- =====================================================================
-- Idempotente: o ON CONFLICT cobre reexecucao da migration.
INSERT INTO public.sgsst_aso_exames (empresa_id, aso_id, exame_id)
SELECT a.empresa_id, a.id, a.exame_id
FROM public.sgsst_asos a
WHERE a.exame_id IS NOT NULL
ON CONFLICT (aso_id, exame_id) DO NOTHING;

-- Retro-preenche a identificacao da organizacao nos ASOs ja emitidos, para o PDF
-- deles nao sair sem nome nem CNPJ.
UPDATE public.sgsst_asos a
SET empresa_nome = e.nome,
    empresa_cnpj = e.cnpj
FROM public.empresas e
WHERE e.id = a.empresa_id
  AND a.empresa_nome IS NULL;
