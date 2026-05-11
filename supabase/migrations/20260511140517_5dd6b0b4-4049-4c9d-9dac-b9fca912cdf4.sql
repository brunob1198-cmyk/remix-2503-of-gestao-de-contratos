
-- 1. AUDIT LOG
DROP POLICY IF EXISTS "View audit_log" ON public.audit_log;
CREATE POLICY "View audit_log" ON public.audit_log
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = audit_log.user_id
      AND p.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- 2. FATURAMENTOS CONTA AZUL
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.faturamentos_conta_azul;
CREATE POLICY "View faturamentos_conta_azul empresa scoped" ON public.faturamentos_conta_azul
FOR SELECT TO authenticated
USING (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id));

-- 3. FCA EVENTOS
DROP POLICY IF EXISTS "FCA eventos are viewable by everyone" ON public.fca_eventos;
DROP POLICY IF EXISTS "Users can delete their own FCA eventos" ON public.fca_eventos;
DROP POLICY IF EXISTS "Users can insert FCA eventos" ON public.fca_eventos;
DROP POLICY IF EXISTS "Users can update their own FCA eventos" ON public.fca_eventos;

CREATE POLICY "View fca_eventos by project access" ON public.fca_eventos
FOR SELECT TO authenticated USING (public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Insert fca_eventos by project access" ON public.fca_eventos
FOR INSERT TO authenticated WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Update fca_eventos by project access" ON public.fca_eventos
FOR UPDATE TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id))
WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Delete fca_eventos by project access" ON public.fca_eventos
FOR DELETE TO authenticated USING (public.user_can_access_projeto(auth.uid(), projeto_id));

-- 4. CUSTO REAL ERP
DROP POLICY IF EXISTS "Users can view costs of their projects" ON public.custo_real_erp;
DROP POLICY IF EXISTS "Users can update category of their project costs" ON public.custo_real_erp;

CREATE POLICY "View custo_real_erp by project access" ON public.custo_real_erp
FOR SELECT TO authenticated
USING (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id));
CREATE POLICY "Update custo_real_erp by project access" ON public.custo_real_erp
FOR UPDATE TO authenticated
USING (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
WITH CHECK (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id));

-- 5. ITENS LPU
DROP POLICY IF EXISTS "Manage itens_lpu" ON public.itens_lpu;
DROP POLICY IF EXISTS "Update itens_lpu" ON public.itens_lpu;
DROP POLICY IF EXISTS "Delete itens_lpu" ON public.itens_lpu;

CREATE POLICY "Insert itens_lpu" ON public.itens_lpu
FOR INSERT TO authenticated
WITH CHECK (
  CASE WHEN projeto_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE public.user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente' END
);
CREATE POLICY "Update itens_lpu" ON public.itens_lpu
FOR UPDATE TO authenticated
USING (
  CASE WHEN projeto_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE public.user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente' END
)
WITH CHECK (
  CASE WHEN projeto_id IS NULL THEN has_role(auth.uid(), 'admin'::app_role)
       ELSE public.user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente' END
);
CREATE POLICY "Delete itens_lpu" ON public.itens_lpu
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), projeto_id))
);

-- 6. PROFILES
DROP POLICY IF EXISTS "View basic profiles same empresa" ON public.profiles;
CREATE POLICY "View profiles self or admin" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (empresa_id = public.get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

-- 7. STORAGE: contratos
DROP POLICY IF EXISTS "Allow authenticated users to read contracts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload contracts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete contracts" ON storage.objects;

CREATE POLICY "Read contratos same empresa" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contratos'
  AND EXISTS (
    SELECT 1 FROM public.contratos c
    WHERE c.empresa_id = public.get_user_empresa_id(auth.uid())
      AND c.arquivo_url LIKE '%' || storage.objects.name || '%'
  )
);
CREATE POLICY "Upload contratos authenticated" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos' AND public.get_user_empresa_id(auth.uid()) IS NOT NULL);
CREATE POLICY "Delete contratos same empresa" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contratos'
  AND EXISTS (
    SELECT 1 FROM public.contratos c
    WHERE c.empresa_id = public.get_user_empresa_id(auth.uid())
      AND c.arquivo_url LIKE '%' || storage.objects.name || '%'
  )
);

-- 8. STORAGE: medicoes-pdf
DROP POLICY IF EXISTS "Allow Service Role Upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow Service Role Delete" ON storage.objects;
CREATE POLICY "Authenticated upload medicoes-pdf" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'medicoes-pdf');
CREATE POLICY "Authenticated delete medicoes-pdf" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'medicoes-pdf');

-- 9. STORAGE: diario-fotos public upload/delete
DROP POLICY IF EXISTS "public_upload" ON storage.objects;
DROP POLICY IF EXISTS "public_delete" ON storage.objects;

-- 10. MEDICAO_EXPORTS (medicao_id -> lancamentos_medicao -> site)
DROP POLICY IF EXISTS "Users can insert exports" ON public.medicao_exports;
DROP POLICY IF EXISTS "Users can view exports for their medicoes" ON public.medicao_exports;

CREATE POLICY "View medicao_exports authenticated" ON public.medicao_exports
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lancamentos_medicao lm
    WHERE lm.id = medicao_exports.medicao_id
      AND public.user_can_access_site(auth.uid(), lm.site_id)
  )
);
CREATE POLICY "Insert medicao_exports authenticated" ON public.medicao_exports
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lancamentos_medicao lm
    WHERE lm.id = medicao_exports.medicao_id
      AND public.user_can_access_site(auth.uid(), lm.site_id)
  )
);

-- 11. FOTO GEOLOCALIZACAO AJUSTES
DROP POLICY IF EXISTS "Qualquer usuario pode atualizar ajustes" ON public.foto_geolocalizacao_ajustes;
DROP POLICY IF EXISTS "Qualquer usuario pode inserir/atualizar ajustes" ON public.foto_geolocalizacao_ajustes;
DROP POLICY IF EXISTS "Qualquer usuario pode ver ajustes" ON public.foto_geolocalizacao_ajustes;

CREATE POLICY "View foto_geolocalizacao_ajustes by access" ON public.foto_geolocalizacao_ajustes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.diario_fotos df
    JOIN public.diarios_obra d ON d.id = df.diario_id
    WHERE df.id = foto_geolocalizacao_ajustes.foto_id
      AND public.user_can_access_site(auth.uid(), d.site_id)
  )
);
CREATE POLICY "Insert foto_geolocalizacao_ajustes by access" ON public.foto_geolocalizacao_ajustes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diario_fotos df
    JOIN public.diarios_obra d ON d.id = df.diario_id
    WHERE df.id = foto_geolocalizacao_ajustes.foto_id
      AND public.user_can_access_site(auth.uid(), d.site_id)
  )
);
CREATE POLICY "Update foto_geolocalizacao_ajustes by access" ON public.foto_geolocalizacao_ajustes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.diario_fotos df
    JOIN public.diarios_obra d ON d.id = df.diario_id
    WHERE df.id = foto_geolocalizacao_ajustes.foto_id
      AND public.user_can_access_site(auth.uid(), d.site_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diario_fotos df
    JOIN public.diarios_obra d ON d.id = df.diario_id
    WHERE df.id = foto_geolocalizacao_ajustes.foto_id
      AND public.user_can_access_site(auth.uid(), d.site_id)
  )
);

-- 12. MAPEAMENTO CATEGORIAS ERP
DROP POLICY IF EXISTS "Authenticated can update mappings" ON public.mapeamento_categorias_erp;
CREATE POLICY "Admins can update mappings" ON public.mapeamento_categorias_erp
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 13. DIARIOS CAMPO
DROP POLICY IF EXISTS "Delete diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "Insert diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "Update diarios_campo" ON public.diarios_campo;
DROP POLICY IF EXISTS "View diarios_campo" ON public.diarios_campo;

CREATE POLICY "View diarios_campo" ON public.diarios_campo
FOR SELECT TO authenticated
USING (
  CASE WHEN site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), site_id)
       WHEN projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), projeto_id)
       ELSE false END
);
CREATE POLICY "Insert diarios_campo" ON public.diarios_campo
FOR INSERT TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) <> 'cliente'
  AND CASE WHEN site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), site_id)
           WHEN projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), projeto_id)
           ELSE false END
);
CREATE POLICY "Update diarios_campo" ON public.diarios_campo
FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) <> 'cliente'
  AND CASE WHEN site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), site_id)
           WHEN projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), projeto_id)
           ELSE false END
);
CREATE POLICY "Delete diarios_campo" ON public.diarios_campo
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND CASE WHEN site_id IS NOT NULL THEN public.user_can_access_site(auth.uid(), site_id)
           WHEN projeto_id IS NOT NULL THEN public.user_can_access_projeto(auth.uid(), projeto_id)
           ELSE false END
);

-- 14. FLASH INTEGRATION LOGS
DROP POLICY IF EXISTS "Users can insert their own integration logs" ON public.flash_integration_logs;
DROP POLICY IF EXISTS "Users can update their own integration logs" ON public.flash_integration_logs;

CREATE POLICY "Admins insert flash_integration_logs" ON public.flash_integration_logs
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id = public.get_user_empresa_id(auth.uid())
);
CREATE POLICY "Admins update flash_integration_logs" ON public.flash_integration_logs
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id = public.get_user_empresa_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id = public.get_user_empresa_id(auth.uid())
);
