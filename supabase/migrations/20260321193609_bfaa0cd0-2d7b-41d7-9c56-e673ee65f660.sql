-- Fix 1: Restrict ERP config SELECT to hide auth_token from non-admins
DROP POLICY IF EXISTS "View own empresa config" ON public.integracoes_erp_config;

CREATE POLICY "Admin view own empresa config"
ON public.integracoes_erp_config
FOR SELECT
TO authenticated
USING (
  empresa_id = get_user_empresa_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 2: Restrict empresas INSERT to only users without an empresa
DROP POLICY IF EXISTS "Authenticated can insert empresa" ON public.empresas;

CREATE POLICY "Users without empresa can insert"
ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_empresa_id(auth.uid()) IS NULL
);

-- Fix 3: Update user_can_access_projeto to restrict client-role users
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = _projeto_id
    AND p.empresa_id = public.get_user_empresa_id(_user_id)
    AND (
      public.get_user_role(_user_id) != 'cliente'
      OR EXISTS (
        SELECT 1 FROM public.sites s
        JOIN public.user_sites us ON us.site_id = s.id
        WHERE s.projeto_id = _projeto_id
        AND us.user_id = _user_id
      )
    )
  )
$$;