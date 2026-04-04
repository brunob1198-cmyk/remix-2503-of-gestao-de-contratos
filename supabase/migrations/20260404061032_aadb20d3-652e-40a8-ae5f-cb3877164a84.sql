CREATE POLICY "Users can update category of their project costs"
ON public.custo_real_erp
FOR UPDATE
TO authenticated
USING (
  (projeto_id IS NULL) OR public.user_can_access_projeto(auth.uid(), projeto_id)
)
WITH CHECK (
  (projeto_id IS NULL) OR public.user_can_access_projeto(auth.uid(), projeto_id)
);