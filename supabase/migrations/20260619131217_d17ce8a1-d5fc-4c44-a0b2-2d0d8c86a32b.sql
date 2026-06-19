DROP POLICY IF EXISTS "Delete fornecedores" ON public.fornecedores;
CREATE POLICY "Delete fornecedores" ON public.fornecedores
FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');