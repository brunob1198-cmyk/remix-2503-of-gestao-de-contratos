-- Criar view para facilitar a extração de dados do Flash para o Power BI
CREATE OR REPLACE VIEW public.view_flash_transactions AS
SELECT 
    t.id,
    t.empresa_id,
    t.external_id,
    t.transaction_date AS data,
    t.amount / 100.0 AS valor,
    -- Tipo
    COALESCE(t.payload_json->>'type', t.payload_json->'category'->>'name', 'indefinido') AS type,
    -- Categoria
    COALESCE(t.payload_json->'category'->>'name', t.payload_json->>'category', '—') AS category,
    -- Comentários
    COALESCE(t.payload_json->>'comments', t.payload_json->>'comment', '—') AS comments,
    -- Centro de Custo
    COALESCE(t.payload_json->'costCenter'->>'name', t.payload_json->'cost_center'->>'name', t.payload_json->>'centro_custo', '—') AS cost_center,
    COALESCE(t.payload_json->'costCenter'->>'id', t.payload_json->>'costCenterId', t.payload_json->>'cost_center_id') AS cost_center_id,
    -- Descrição (priorizando comments conforme solicitado)
    COALESCE(
        t.payload_json->>'comments', 
        t.payload_json->'category'->>'name', 
        t.payload_json->>'description', 
        '—'
    ) AS description,
    -- Usuário
    COALESCE(
        t.payload_json->'employee'->>'name', 
        t.payload_json->'user'->>'name', 
        t.payload_json->'user'->>'email', 
        '—'
    ) AS usuario,
    -- Tentativa de mapeamento para Projeto
    p.id AS projeto_id,
    p.codigo AS projeto_codigo,
    p.nome AS projeto_nome,
    -- Normalização
    n.status AS status_normalizacao,
    n.conta_azul_category_name AS categoria_mapeada,
    n.enviado_at IS NOT NULL AS enviado_ao_conta_azul
FROM public.flash_transactions_raw t
LEFT JOIN public.flash_normalizacao n ON n.flash_transaction_id = t.id
LEFT JOIN public.projetos p ON (
    -- Tenta casar o início do nome do centro de custo com o código do projeto
    split_part(COALESCE(t.payload_json->'costCenter'->>'name', t.payload_json->'cost_center'->>'name', ''), ' ', 1) = p.codigo
    OR 
    COALESCE(t.payload_json->'costCenter'->>'name', t.payload_json->'cost_center'->>'name', '') ILIKE '%' || p.codigo || '%'
);

-- Garantir acesso à nova view
GRANT SELECT ON public.view_flash_transactions TO authenticated;
GRANT SELECT ON public.view_flash_transactions TO service_role;

-- Comentários explicativos na view
COMMENT ON VIEW public.view_flash_transactions IS 'View consolidada para transações Flash com mapeamento de campos do JSONB corrigido.';
