
-- 1. Fix sites cross-tenant access
DROP POLICY IF EXISTS site_select ON public.sites;
DROP POLICY IF EXISTS site_modify ON public.sites;

CREATE POLICY site_select ON public.sites
  FOR SELECT TO authenticated
  USING (projeto_id IN (SELECT id FROM public.projetos WHERE empresa_id = public.get_user_empresa_id(auth.uid())));

CREATE POLICY site_modify ON public.sites
  FOR ALL TO authenticated
  USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE empresa_id = public.get_user_empresa_id(auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','interno'))
  )
  WITH CHECK (
    projeto_id IN (SELECT id FROM public.projetos WHERE empresa_id = public.get_user_empresa_id(auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','interno'))
  );

-- 2. get_user_role default to least-privilege 'cliente'
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    'cliente'
  )
$function$;

-- 3. Profiles PII: revoke column-level SELECT from authenticated; provide owner-only RPC
REVOKE SELECT (cpf, data_nascimento, sexo) ON public.profiles FROM authenticated;
REVOKE SELECT (cpf, data_nascimento, sexo) ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_profile_pii()
RETURNS TABLE(cpf text, data_nascimento date, sexo text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.cpf, p.data_nascimento, p.sexo
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile_pii() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_pii() TO authenticated;

-- 4. Photo geolocation cache: require authentication
DROP POLICY IF EXISTS "Anyone can view photo geolocation cache" ON public.foto_geolocalizacao_cache;
DROP POLICY IF EXISTS "Authenticated users can manage photo geolocation cache" ON public.foto_geolocalizacao_cache;

CREATE POLICY "Authenticated can view photo geolocation cache"
  ON public.foto_geolocalizacao_cache
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage photo geolocation cache"
  ON public.foto_geolocalizacao_cache
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Flash integration logs: scope to authenticated role only
DROP POLICY IF EXISTS "Users can view their own integration logs" ON public.flash_integration_logs;

CREATE POLICY "Users can view their own integration logs"
  ON public.flash_integration_logs
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- 6. Contratos storage bucket: enforce empresa_id path prefix on uploads
DROP POLICY IF EXISTS "Upload contratos authenticated" ON storage.objects;

CREATE POLICY "Upload contratos by empresa"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND public.get_user_empresa_id(auth.uid()) IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_user_empresa_id(auth.uid())::text
  );
