-- 1. Remove public (unauthenticated) read of construction photos
DROP POLICY IF EXISTS "Public read access for diario-fotos" ON storage.objects;
DROP POLICY IF EXISTS "public_read" ON storage.objects;

-- 2. Geolocation cache: scope reads to photos the user can access
DROP POLICY IF EXISTS "Authenticated can view photo geolocation cache" ON public.foto_geolocalizacao_cache;
CREATE POLICY "Users view geolocation cache for accessible photos"
ON public.foto_geolocalizacao_cache
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.diario_fotos f
    JOIN public.diarios_obra d ON d.id = f.diario_id
    WHERE public.user_can_access_diario(auth.uid(), d.id)
      AND (
        f.url = foto_geolocalizacao_cache.url
        OR f.thumb_url = foto_geolocalizacao_cache.url
        OR f.thumb_600_url = foto_geolocalizacao_cache.url
      )
  )
);

-- 3. Photo captions: scope to accessible photos
DROP POLICY IF EXISTS "Allow authenticated users to manage photo captions" ON public.medicao_report_photo_captions;
CREATE POLICY "Users manage captions for accessible photos"
ON public.medicao_report_photo_captions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.diario_fotos f
    JOIN public.diarios_obra d ON d.id = f.diario_id
    WHERE f.id = medicao_report_photo_captions.foto_id
      AND public.user_can_access_diario(auth.uid(), d.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.diario_fotos f
    JOIN public.diarios_obra d ON d.id = f.diario_id
    WHERE f.id = medicao_report_photo_captions.foto_id
      AND public.user_can_access_diario(auth.uid(), d.id)
  )
);

-- 4. Report templates: scope to accessible projects
DROP POLICY IF EXISTS "Allow authenticated users to manage report templates" ON public.report_templates;
CREATE POLICY "Users manage report templates of their projects"
ON public.report_templates
FOR ALL
TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id))
WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE INDEX IF NOT EXISTS idx_foto_geo_cache_url ON public.foto_geolocalizacao_cache (url);
CREATE INDEX IF NOT EXISTS idx_diario_fotos_url ON public.diario_fotos (url);
CREATE INDEX IF NOT EXISTS idx_medicao_captions_foto_id ON public.medicao_report_photo_captions (foto_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_projeto_id ON public.report_templates (projeto_id);