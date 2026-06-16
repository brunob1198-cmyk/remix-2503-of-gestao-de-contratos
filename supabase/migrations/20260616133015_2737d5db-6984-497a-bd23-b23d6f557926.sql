
-- ============================================================
-- Fix CROSS_TENANT_DATA_EXPOSURE on avaliacoes_fornecedor
-- ============================================================
DROP POLICY IF EXISTS "avaliacoes_select" ON public.avaliacoes_fornecedor;
DROP POLICY IF EXISTS "avaliacoes_insert" ON public.avaliacoes_fornecedor;
DROP POLICY IF EXISTS "avaliacoes_update" ON public.avaliacoes_fornecedor;
DROP POLICY IF EXISTS "avaliacoes_delete" ON public.avaliacoes_fornecedor;

CREATE POLICY "avaliacoes_select_scoped" ON public.avaliacoes_fornecedor
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = avaliacoes_fornecedor.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "avaliacoes_insert_scoped" ON public.avaliacoes_fornecedor
FOR INSERT TO authenticated
WITH CHECK (
  avaliado_por = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = avaliacoes_fornecedor.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "avaliacoes_update_scoped" ON public.avaliacoes_fornecedor
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = avaliacoes_fornecedor.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "avaliacoes_delete_scoped" ON public.avaliacoes_fornecedor
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = avaliacoes_fornecedor.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- ============================================================
-- Remove legacy permissive 'true' policies on pedido_itens
-- (the scoped 'View/Insert/Update/Delete pedido_itens' policies remain)
-- ============================================================
DROP POLICY IF EXISTS "pedido_itens_select" ON public.pedido_itens;
DROP POLICY IF EXISTS "pedido_itens_insert" ON public.pedido_itens;
DROP POLICY IF EXISTS "pedido_itens_update" ON public.pedido_itens;
DROP POLICY IF EXISTS "pedido_itens_delete" ON public.pedido_itens;

-- ============================================================
-- Scope pedido_recebimentos
-- ============================================================
DROP POLICY IF EXISTS "recebimentos_select" ON public.pedido_recebimentos;

CREATE POLICY "recebimentos_select_scoped" ON public.pedido_recebimentos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = pedido_recebimentos.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "recebimentos_update_scoped" ON public.pedido_recebimentos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = pedido_recebimentos.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "recebimentos_delete_scoped" ON public.pedido_recebimentos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE p.id = pedido_recebimentos.pedido_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- ============================================================
-- Scope pedido_recebimento_itens
-- ============================================================
DROP POLICY IF EXISTS "recebimentos_itens_select" ON public.pedido_recebimento_itens;
DROP POLICY IF EXISTS "recebimentos_itens_insert" ON public.pedido_recebimento_itens;

CREATE POLICY "recebimentos_itens_select_scoped" ON public.pedido_recebimento_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedido_recebimentos r
    JOIN public.pedidos p ON p.id = r.pedido_id
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE r.id = pedido_recebimento_itens.recebimento_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "recebimentos_itens_insert_scoped" ON public.pedido_recebimento_itens
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedido_recebimentos r
    JOIN public.pedidos p ON p.id = r.pedido_id
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE r.id = pedido_recebimento_itens.recebimento_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "recebimentos_itens_update_scoped" ON public.pedido_recebimento_itens
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedido_recebimentos r
    JOIN public.pedidos p ON p.id = r.pedido_id
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE r.id = pedido_recebimento_itens.recebimento_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "recebimentos_itens_delete_scoped" ON public.pedido_recebimento_itens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pedido_recebimentos r
    JOIN public.pedidos p ON p.id = r.pedido_id
    JOIN public.projetos pr ON pr.id = p.projeto_id
    WHERE r.id = pedido_recebimento_itens.recebimento_id
      AND pr.empresa_id = public.get_user_empresa_id(auth.uid())
  )
);

-- ============================================================
-- Scope projeto_bdi_mensal
-- ============================================================
DROP POLICY IF EXISTS "pbdi_select" ON public.projeto_bdi_mensal;
DROP POLICY IF EXISTS "pbdi_update" ON public.projeto_bdi_mensal;
DROP POLICY IF EXISTS "pbdi_delete" ON public.projeto_bdi_mensal;

CREATE POLICY "pbdi_select_scoped" ON public.projeto_bdi_mensal
FOR SELECT TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "pbdi_update_scoped" ON public.projeto_bdi_mensal
FOR UPDATE TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id))
WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "pbdi_delete_scoped" ON public.projeto_bdi_mensal
FOR DELETE TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id));

-- ============================================================
-- Restrict foto_geolocalizacao_cache writes
-- (keep SELECT for authenticated — it is a shared, non-sensitive coordinate cache)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can manage photo geolocation cache" ON public.foto_geolocalizacao_cache;

CREATE POLICY "Service role manages photo geolocation cache" ON public.foto_geolocalizacao_cache
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert photo geolocation cache" ON public.foto_geolocalizacao_cache
FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================================
-- Storage buckets: restrict writes to service_role (uploads happen via edge functions / external worker)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload to diario-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from diario-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cover pages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete cover pages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload medicoes-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete medicoes-pdf" ON storage.objects;

CREATE POLICY "service_role manage diario-fotos" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'diario-fotos') WITH CHECK (bucket_id = 'diario-fotos');

CREATE POLICY "service_role manage medicao-capas" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'medicao-capas') WITH CHECK (bucket_id = 'medicao-capas');

CREATE POLICY "service_role manage medicoes-pdf" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'medicoes-pdf') WITH CHECK (bucket_id = 'medicoes-pdf');

CREATE POLICY "service_role manage timeline-evidencias" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'timeline-evidencias') WITH CHECK (bucket_id = 'timeline-evidencias');
