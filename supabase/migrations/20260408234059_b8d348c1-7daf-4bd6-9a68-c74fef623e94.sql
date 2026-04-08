
-- Drop existing policies
DROP POLICY IF EXISTS "View diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "Insert diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "Update diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "Delete diarios_campo" ON public.diarios_campo;

-- Recreate with support for NULL site_id (fallback to projeto access)
CREATE POLICY "View diarios_campo" ON public.diarios_campo
  FOR SELECT USING (
    CASE
      WHEN site_id IS NOT NULL THEN user_can_access_site(auth.uid(), site_id)
      WHEN projeto_id IS NOT NULL THEN user_can_access_projeto(auth.uid(), projeto_id)
      ELSE false
    END
  );

CREATE POLICY "Insert diarios_campo" ON public.diarios_campo
  FOR INSERT WITH CHECK (
    get_user_role(auth.uid()) <> 'cliente'
    AND (
      CASE
        WHEN site_id IS NOT NULL THEN user_can_access_site(auth.uid(), site_id)
        WHEN projeto_id IS NOT NULL THEN user_can_access_projeto(auth.uid(), projeto_id)
        ELSE false
      END
    )
  );

CREATE POLICY "Update diarios_campo" ON public.diarios_campo
  FOR UPDATE USING (
    get_user_role(auth.uid()) <> 'cliente'
    AND (
      CASE
        WHEN site_id IS NOT NULL THEN user_can_access_site(auth.uid(), site_id)
        WHEN projeto_id IS NOT NULL THEN user_can_access_projeto(auth.uid(), projeto_id)
        ELSE false
      END
    )
  );

CREATE POLICY "Delete diarios_campo" ON public.diarios_campo
  FOR DELETE USING (
    has_role(auth.uid(), 'admin')
    AND (
      CASE
        WHEN site_id IS NOT NULL THEN user_can_access_site(auth.uid(), site_id)
        WHEN projeto_id IS NOT NULL THEN user_can_access_projeto(auth.uid(), projeto_id)
        ELSE false
      END
    )
  );
