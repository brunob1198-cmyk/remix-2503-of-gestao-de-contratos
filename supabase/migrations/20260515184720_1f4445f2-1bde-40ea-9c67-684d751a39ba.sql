CREATE OR REPLACE VIEW view_flash_transactions AS
SELECT 
    t.id,
    t.empresa_id,
    t.external_id,
    t.transaction_date AS data,
    (t.amount / 100.0) AS valor,
    COALESCE(
        (t.payload_json ->> 'type'),
        ((t.payload_json -> 'category') ->> 'name'),
        'indefinido'
    ) AS type,
    COALESCE(
        ((t.payload_json -> 'category') ->> 'name'),
        (t.payload_json ->> 'category'),
        '—'
    ) AS category,
    COALESCE(
        (t.payload_json ->> 'comments'),
        (t.payload_json ->> 'comment'),
        '—'
  ) AS comments,
    COALESCE(
        ((t.payload_json -> 'costCenter') ->> 'name'),
        ((t.payload_json -> 'cost_center') ->> 'name'),
        (t.payload_json ->> 'centro_custo'),
        '—'
    ) AS cost_center,
    COALESCE(
        ((t.payload_json -> 'costCenter') ->> 'id'),
        (t.payload_json ->> 'costCenterId'),
        (t.payload_json ->> 'cost_center_id')
    ) AS cost_center_id,
    -- Conforme pedido: comments -> category.name -> description
    COALESCE(
        (t.payload_json ->> 'comments'),
        ((t.payload_json -> 'category') ->> 'name'),
        (t.payload_json ->> 'description'),
        '—'
    ) AS description,
    COALESCE(
        ((t.payload_json -> 'employee') ->> 'name'),
        ((t.payload_json -> 'user') ->> 'name'),
        ((t.payload_json -> 'user') ->> 'email'),
        '—'
    ) AS usuario,
    p.id AS projeto_id,
    p.codigo AS projeto_codigo,
    p.nome AS projeto_nome,
    n.status AS status_normalizacao,
    n.conta_azul_category_name AS categoria_mapeada,
    (n.enviado_at IS NOT NULL) AS enviado_ao_conta_azul
FROM flash_transactions_raw t
LEFT JOIN flash_normalizacao n ON n.flash_transaction_id = t.id
LEFT JOIN projetos p ON (
    split_part(COALESCE(((t.payload_json -> 'costCenter') ->> 'name'), ((t.payload_json -> 'cost_center') ->> 'name'), ''), ' ', 1) = p.codigo 
    OR 
    COALESCE(((t.payload_json -> 'costCenter') ->> 'name'), ((t.payload_json -> 'cost_center') ->> 'name'), '') ILIKE '%' || p.codigo || '%'
);