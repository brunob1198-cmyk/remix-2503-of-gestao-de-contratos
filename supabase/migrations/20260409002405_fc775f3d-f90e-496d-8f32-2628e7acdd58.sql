DROP POLICY IF EXISTS "View diario_campo_fotos" ON public.diario_campo_fotos;
DROP POLICY IF EXISTS "Insert diario_campo_fotos" ON public.diario_campo_fotos;
DROP POLICY IF EXISTS "Delete diario_campo_fotos" ON public.diario_campo_fotos;

CREATE POLICY "View diario_campo_fotos"
ON public.diario_campo_fotos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.diarios_campo dc
    WHERE dc.id = diario_campo_fotos.diario_campo_id
      AND CASE
        WHEN dc.site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), dc.site_id)
        WHEN dc.projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), dc.projeto_id)
        ELSE false
      END
  )
);

CREATE POLICY "Insert diario_campo_fotos"
ON public.diario_campo_fotos
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) <> 'cliente'
  AND EXISTS (
    SELECT 1
    FROM public.diarios_campo dc
    WHERE dc.id = diario_campo_fotos.diario_campo_id
      AND CASE
        WHEN dc.site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), dc.site_id)
        WHEN dc.projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), dc.projeto_id)
        ELSE false
      END
  )
);

CREATE POLICY "Delete diario_campo_fotos"
ON public.diario_campo_fotos
FOR DELETE
TO authenticated
USING (
  public.get_user_role(auth.uid()) <> 'cliente'
  AND EXISTS (
    SELECT 1
    FROM public.diarios_campo dc
    WHERE dc.id = diario_campo_fotos.diario_campo_id
      AND CASE
        WHEN dc.site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), dc.site_id)
        WHEN dc.projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), dc.projeto_id)
        ELSE false
      END
  )
);