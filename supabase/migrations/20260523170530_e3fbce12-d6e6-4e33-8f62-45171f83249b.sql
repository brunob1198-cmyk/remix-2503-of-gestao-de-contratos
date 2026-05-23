
-- =========================================================
-- 1. mkp_parametros: drop public-all policy, scope to empresa
-- =========================================================
DROP POLICY IF EXISTS "mkp_parametros_all" ON public.mkp_parametros;

CREATE POLICY "mkp_parametros_select_empresa"
ON public.mkp_parametros FOR SELECT TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "mkp_parametros_insert_empresa"
ON public.mkp_parametros FOR INSERT TO authenticated
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "mkp_parametros_update_empresa"
ON public.mkp_parametros FOR UPDATE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
)
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "mkp_parametros_delete_empresa"
ON public.mkp_parametros FOR DELETE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

-- =========================================================
-- 2. projeto_impostos: drop public-all policy, scope to empresa
-- =========================================================
DROP POLICY IF EXISTS "projeto_impostos_all" ON public.projeto_impostos;

CREATE POLICY "projeto_impostos_select_empresa"
ON public.projeto_impostos FOR SELECT TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "projeto_impostos_insert_empresa"
ON public.projeto_impostos FOR INSERT TO authenticated
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "projeto_impostos_update_empresa"
ON public.projeto_impostos FOR UPDATE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
)
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "projeto_impostos_delete_empresa"
ON public.projeto_impostos FOR DELETE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

-- =========================================================
-- 3. Storage: contratos bucket — drop broad/public policies
-- =========================================================
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own contracts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own contracts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contracts" ON storage.objects;

-- Add a tenant-scoped UPDATE policy for contratos (was missing)
CREATE POLICY "Update contratos same empresa"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contratos'
  AND EXISTS (
    SELECT 1 FROM public.contratos c
    WHERE c.empresa_id = public.get_user_empresa_id(auth.uid())
      AND c.arquivo_url LIKE ('%' || objects.name || '%')
  )
)
WITH CHECK (
  bucket_id = 'contratos'
  AND public.get_user_empresa_id(auth.uid()) IS NOT NULL
);

-- =========================================================
-- 4. Diarios / producao / medicao / escopo / faturamentos
--    Rewrite policies to explicitly require empresa match.
-- =========================================================

-- diarios_obra
DROP POLICY IF EXISTS "diario_select" ON public.diarios_obra;
DROP POLICY IF EXISTS "diario_modify" ON public.diarios_obra;

CREATE POLICY "diario_select"
ON public.diarios_obra FOR SELECT TO authenticated
USING (public.user_can_access_site(auth.uid(), site_id));

CREATE POLICY "diario_modify"
ON public.diarios_obra FOR ALL TO authenticated
USING (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
)
WITH CHECK (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
);

-- lancamentos_producao
DROP POLICY IF EXISTS "producao_select" ON public.lancamentos_producao;
DROP POLICY IF EXISTS "producao_modify" ON public.lancamentos_producao;

CREATE POLICY "producao_select"
ON public.lancamentos_producao FOR SELECT TO authenticated
USING (public.user_can_access_site(auth.uid(), site_id));

CREATE POLICY "producao_modify"
ON public.lancamentos_producao FOR ALL TO authenticated
USING (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
)
WITH CHECK (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
);

-- lancamentos_medicao
DROP POLICY IF EXISTS "medicao_select" ON public.lancamentos_medicao;
DROP POLICY IF EXISTS "medicao_modify" ON public.lancamentos_medicao;

CREATE POLICY "medicao_select"
ON public.lancamentos_medicao FOR SELECT TO authenticated
USING (public.user_can_access_site(auth.uid(), site_id));

CREATE POLICY "medicao_modify"
ON public.lancamentos_medicao FOR ALL TO authenticated
USING (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
)
WITH CHECK (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
);

-- escopo_itens
DROP POLICY IF EXISTS "escopo_select" ON public.escopo_itens;
DROP POLICY IF EXISTS "escopo_modify" ON public.escopo_itens;

CREATE POLICY "escopo_select"
ON public.escopo_itens FOR SELECT TO authenticated
USING (public.user_can_access_site(auth.uid(), site_id));

CREATE POLICY "escopo_modify"
ON public.escopo_itens FOR ALL TO authenticated
USING (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
)
WITH CHECK (
  public.user_can_access_site(auth.uid(), site_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
);

-- faturamentos
DROP POLICY IF EXISTS "faturamento_select" ON public.faturamentos;
DROP POLICY IF EXISTS "faturamento_modify" ON public.faturamentos;

CREATE POLICY "faturamento_select"
ON public.faturamentos FOR SELECT TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "faturamento_modify"
ON public.faturamentos FOR ALL TO authenticated
USING (
  public.user_can_access_projeto(auth.uid(), projeto_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
)
WITH CHECK (
  public.user_can_access_projeto(auth.uid(), projeto_id)
  AND public.get_user_role(auth.uid()) = ANY (ARRAY['admin','interno'])
);

-- =========================================================
-- 5. custo_real_erp: add INSERT/DELETE policies for users
-- =========================================================
CREATE POLICY "Insert custo_real_erp by project access"
ON public.custo_real_erp FOR INSERT TO authenticated
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "Delete custo_real_erp by project access"
ON public.custo_real_erp FOR DELETE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

-- =========================================================
-- 6. faturamentos_conta_azul: add INSERT / UPDATE / DELETE
-- =========================================================
CREATE POLICY "Insert faturamentos_conta_azul empresa scoped"
ON public.faturamentos_conta_azul FOR INSERT TO authenticated
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "Update faturamentos_conta_azul empresa scoped"
ON public.faturamentos_conta_azul FOR UPDATE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
)
WITH CHECK (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "Delete faturamentos_conta_azul empresa scoped"
ON public.faturamentos_conta_azul FOR DELETE TO authenticated
USING (
  projeto_id IS NOT NULL
  AND public.user_can_access_projeto(auth.uid(), projeto_id)
);
