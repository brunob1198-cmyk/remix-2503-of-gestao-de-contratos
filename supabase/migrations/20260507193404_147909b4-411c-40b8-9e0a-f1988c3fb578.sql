
DROP POLICY IF EXISTS "Users can view company contracts" ON public.contratos;
DROP POLICY IF EXISTS "Users can create company contracts" ON public.contratos;
DROP POLICY IF EXISTS "Users can update company contracts" ON public.contratos;
DROP POLICY IF EXISTS "Users can delete company contracts" ON public.contratos;

CREATE POLICY "Users can view company contracts"
ON public.contratos FOR SELECT TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "Users can create company contracts"
ON public.contratos FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.get_user_role(auth.uid()) <> 'cliente'
);

CREATE POLICY "Users can update company contracts"
ON public.contratos FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.get_user_role(auth.uid()) <> 'cliente'
)
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.get_user_role(auth.uid()) <> 'cliente'
);

CREATE POLICY "Users can delete company contracts"
ON public.contratos FOR DELETE TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
