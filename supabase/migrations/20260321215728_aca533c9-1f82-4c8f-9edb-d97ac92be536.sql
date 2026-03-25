
DROP POLICY IF EXISTS "Insert projetos" ON public.projetos;

CREATE POLICY "Insert projetos"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK (
  (empresa_id = get_user_empresa_id(auth.uid()))
  AND (COALESCE(get_user_role(auth.uid()), 'interno') <> 'cliente')
);
