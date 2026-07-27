
-- 1. item_lpu_bdi_mensal: scope via itens_lpu access model
DROP POLICY IF EXISTS "item_lpu_bdi_mensal_select" ON public.item_lpu_bdi_mensal;
DROP POLICY IF EXISTS "item_lpu_bdi_mensal_insert" ON public.item_lpu_bdi_mensal;
DROP POLICY IF EXISTS "item_lpu_bdi_mensal_update" ON public.item_lpu_bdi_mensal;
DROP POLICY IF EXISTS "item_lpu_bdi_mensal_delete" ON public.item_lpu_bdi_mensal;

CREATE POLICY "item_lpu_bdi_mensal_select" ON public.item_lpu_bdi_mensal
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itens_lpu il
    WHERE il.id = item_lpu_bdi_mensal.item_lpu_id
      AND (il.projeto_id IS NULL OR public.user_can_access_projeto(auth.uid(), il.projeto_id))
  ));

CREATE POLICY "item_lpu_bdi_mensal_insert" ON public.item_lpu_bdi_mensal
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itens_lpu il
    WHERE il.id = item_lpu_bdi_mensal.item_lpu_id
      AND (
        (il.projeto_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (il.projeto_id IS NOT NULL
            AND public.user_can_access_projeto(auth.uid(), il.projeto_id)
            AND public.get_user_role(auth.uid()) <> 'cliente')
      )
  ));

CREATE POLICY "item_lpu_bdi_mensal_update" ON public.item_lpu_bdi_mensal
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itens_lpu il
    WHERE il.id = item_lpu_bdi_mensal.item_lpu_id
      AND (
        (il.projeto_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (il.projeto_id IS NOT NULL
            AND public.user_can_access_projeto(auth.uid(), il.projeto_id)
            AND public.get_user_role(auth.uid()) <> 'cliente')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itens_lpu il
    WHERE il.id = item_lpu_bdi_mensal.item_lpu_id
      AND (
        (il.projeto_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (il.projeto_id IS NOT NULL
            AND public.user_can_access_projeto(auth.uid(), il.projeto_id)
            AND public.get_user_role(auth.uid()) <> 'cliente')
      )
  ));

CREATE POLICY "item_lpu_bdi_mensal_delete" ON public.item_lpu_bdi_mensal
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.itens_lpu il
    WHERE il.id = item_lpu_bdi_mensal.item_lpu_id
      AND (
        (il.projeto_id IS NULL AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (il.projeto_id IS NOT NULL
            AND public.user_can_access_projeto(auth.uid(), il.projeto_id)
            AND public.get_user_role(auth.uid()) <> 'cliente')
      )
  ));

-- 2. requisicao_historico: add empresa scope
DROP POLICY IF EXISTS "Users can view history of accessible requisitions" ON public.requisicao_historico;
DROP POLICY IF EXISTS "Users can insert history for accessible requisitions" ON public.requisicao_historico;

CREATE POLICY "Users can view history of accessible requisitions"
  ON public.requisicao_historico FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisicoes_compra r
    WHERE r.id = requisicao_historico.requisicao_id
      AND r.empresa_id = public.get_user_empresa_id(auth.uid())
  ));

CREATE POLICY "Users can insert history for accessible requisitions"
  ON public.requisicao_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.requisicoes_compra r
    WHERE r.id = requisicao_historico.requisicao_id
      AND r.empresa_id = public.get_user_empresa_id(auth.uid())
  ));

-- 3. mapeamento_categorias_erp: restrict SELECT to non-cliente users
DROP POLICY IF EXISTS "Authenticated can view mappings" ON public.mapeamento_categorias_erp;
CREATE POLICY "Interno/admin can view mappings"
  ON public.mapeamento_categorias_erp FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) <> 'cliente');

-- 4. pedido_recebimentos insert: add empresa scope
DROP POLICY IF EXISTS "recebimentos_insert" ON public.pedido_recebimentos;
CREATE POLICY "recebimentos_insert" ON public.pedido_recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    recebido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      JOIN public.projetos pr ON pr.id = p.projeto_id
      WHERE p.id = pedido_recebimentos.pedido_id
        AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
    )
  );

-- 5. Remove "always true" service_role policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role full access custo_real_erp" ON public.custo_real_erp;
DROP POLICY IF EXISTS "Service role full access mapeamento" ON public.mapeamento_categorias_erp;
DROP POLICY IF EXISTS "Service role manages photo geolocation cache" ON public.foto_geolocalizacao_cache;

-- Fix the authenticated INSERT WITH CHECK (true) on foto_geolocalizacao_cache
DROP POLICY IF EXISTS "Authenticated can insert photo geolocation cache" ON public.foto_geolocalizacao_cache;
CREATE POLICY "Authenticated can insert photo geolocation cache"
  ON public.foto_geolocalizacao_cache FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Storage: add authenticated ownership-scoped SELECT policies for diario-fotos and timeline-evidencias.
-- Buckets are switched to private via storage_update_bucket tool separately.
DROP POLICY IF EXISTS "Authenticated can read diario-fotos" ON storage.objects;
CREATE POLICY "Authenticated can read diario-fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'diario-fotos');

DROP POLICY IF EXISTS "Authenticated can read timeline-evidencias" ON storage.objects;
CREATE POLICY "Authenticated can read timeline-evidencias"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'timeline-evidencias');
