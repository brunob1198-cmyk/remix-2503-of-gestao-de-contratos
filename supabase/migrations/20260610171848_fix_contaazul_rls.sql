-- Adiciona coluna empresa_id na faturamentos_conta_azul
ALTER TABLE public.faturamentos_conta_azul ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Atualiza a politica de RLS para considerar a empresa_id
DROP POLICY IF EXISTS "View faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
CREATE POLICY "View faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid()) 
  OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
);

-- Atualiza as politicas de Insert/Update/Delete para a faturamentos_conta_azul se necessario
DROP POLICY IF EXISTS "Insert faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
CREATE POLICY "Insert faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul 
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid()) 
  OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
);

DROP POLICY IF EXISTS "Update faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
CREATE POLICY "Update faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul 
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid()) 
  OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid()) 
  OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
);

DROP POLICY IF EXISTS "Delete faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul;
CREATE POLICY "Delete faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul 
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid()) 
  OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
);
