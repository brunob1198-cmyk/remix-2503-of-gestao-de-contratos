
-- Fix 1: Scope admin role management to same empresa
DROP POLICY IF EXISTS "Admin manage roles" ON public.user_roles;

CREATE POLICY "Admin manage roles same empresa"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND get_user_empresa_id(user_id) = get_user_empresa_id(auth.uid())
);

-- Fix 2: Scope admin site assignments to same empresa
DROP POLICY IF EXISTS "Admin manage site assignments" ON public.user_sites;

CREATE POLICY "Admin manage site assignments same empresa"
ON public.user_sites
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND get_user_empresa_id(user_id) = get_user_empresa_id(auth.uid())
  AND user_can_access_site(auth.uid(), site_id)
);

-- Fix 3: Restrict CPF/personal data visibility - only self and admins
DROP POLICY IF EXISTS "View profiles same empresa" ON public.profiles;

-- Users can see basic info of same empresa colleagues
CREATE POLICY "View basic profiles same empresa"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    empresa_id = get_user_empresa_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  OR (
    empresa_id = get_user_empresa_id(auth.uid())
  )
);
