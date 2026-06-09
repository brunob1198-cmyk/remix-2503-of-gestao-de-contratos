-- 1. Tabelas sem índices em colunas críticas (Foreign Keys e Status)

-- Contratos
CREATE INDEX IF NOT EXISTS idx_contratos_empresa_id ON public.contratos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_contrato_pai_id ON public.contratos (contrato_pai_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status_processamento ON public.contratos (status_processamento);

-- Projetos
CREATE INDEX IF NOT EXISTS idx_projetos_empresa_id ON public.projetos (empresa_id);

-- Faturamentos
CREATE INDEX IF NOT EXISTS idx_faturamentos_projeto_id ON public.faturamentos (projeto_id);
CREATE INDEX IF NOT EXISTS idx_faturamentos_status ON public.faturamentos (status);
CREATE INDEX IF NOT EXISTS idx_faturamento_itens_faturamento_id ON public.faturamento_itens (faturamento_id);

-- Recursos e Diários
CREATE INDEX IF NOT EXISTS idx_diarios_obra_site_id ON public.diarios_obra (site_id);
CREATE INDEX IF NOT EXISTS idx_diario_producao_diario_id ON public.diario_producao (diario_id);
CREATE INDEX IF NOT EXISTS idx_diario_fotos_diario_id ON public.diario_fotos (diario_id);
CREATE INDEX IF NOT EXISTS idx_diario_fotos_diario_producao_id ON public.diario_fotos (diario_producao_id);

-- Cotacoes e Pedidos
CREATE INDEX IF NOT EXISTS idx_cotacoes_empresa_id ON public.cotacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor_id ON public.cotacoes (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_empresa_id ON public.pedidos_compra (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON public.pedido_itens (pedido_id);


-- 2. Otimização de RLS na tabela de Projetos (Removendo subquery pesada de profile)
-- Atualmente a política faz SELECT na profiles para cada linha de projetos.
-- Vamos simplificar usando a função get_user_empresa_id que já está otimizada.

DROP POLICY IF EXISTS "projeto_select" ON public.projetos;
CREATE POLICY "projeto_select" ON public.projetos 
FOR SELECT USING (empresa_id = get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "projeto_modify" ON public.projetos;
CREATE POLICY "projeto_modify" ON public.projetos 
FOR ALL USING (
    empresa_id = get_user_empresa_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'interno'::app_role))
);


-- 3. Limpeza de índices não utilizados (identificados na auditoria)
-- Nota: Mantemos as PKs (pkey) mesmo que o idx_scan seja 0 por segurança de integridade.
-- Removemos apenas índices secundários redundantes.

DROP INDEX IF EXISTS public.idx_projetos_area_id;
DROP INDEX IF EXISTS public.idx_projetos_contrato_ids;
DROP INDEX IF EXISTS public.idx_audit_log_tabela;
DROP INDEX IF EXISTS public.idx_audit_log_user_id;
DROP INDEX IF EXISTS public.idx_audit_log_registro_id;


-- 4. Função de alto custo: user_can_access_site
-- Adicionando índice para otimizar a junção interna usada nessa função
CREATE INDEX IF NOT EXISTS idx_sites_projeto_id ON public.sites (projeto_id);
