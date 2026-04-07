CREATE POLICY "Authenticated can update mappings"
ON public.mapeamento_categorias_erp
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);