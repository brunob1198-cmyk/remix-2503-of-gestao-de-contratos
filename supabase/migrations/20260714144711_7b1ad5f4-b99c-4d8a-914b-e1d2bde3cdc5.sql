
-- Add empresa_id to faturamentos_conta_azul for proper tenant scoping and sync persistence
ALTER TABLE public.faturamentos_conta_azul
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Backfill empresa_id from linked projeto when available
UPDATE public.faturamentos_conta_azul f
SET empresa_id = p.empresa_id
FROM public.projetos p
WHERE f.projeto_id = p.id
  AND f.empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_faturamentos_conta_azul_empresa_id
  ON public.faturamentos_conta_azul(empresa_id);

-- Ensure uniqueness by empresa+erp_id so upsert with onConflict works and avoids cross-tenant collisions
CREATE UNIQUE INDEX IF NOT EXISTS uq_faturamentos_conta_azul_erp_id
  ON public.faturamentos_conta_azul(erp_id);

-- Drop old projeto-only policies and re-create using empresa_id so notes sem projeto ainda apareçam
DROP POLICY IF EXISTS "View faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
DROP POLICY IF EXISTS "Insert faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
DROP POLICY IF EXISTS "Update faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
DROP POLICY IF EXISTS "Delete faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;

CREATE POLICY "View faturamentos_conta_azul empresa scoped"
  ON public.faturamentos_conta_azul FOR SELECT
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Insert faturamentos_conta_azul empresa scoped"
  ON public.faturamentos_conta_azul FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Update faturamentos_conta_azul empresa scoped"
  ON public.faturamentos_conta_azul FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Delete faturamentos_conta_azul empresa scoped"
  ON public.faturamentos_conta_azul FOR DELETE
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));
