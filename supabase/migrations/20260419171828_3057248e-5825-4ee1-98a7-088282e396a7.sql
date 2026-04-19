-- Recriar view_bi_financeiro adicionando area_id e area_nome
DROP VIEW IF EXISTS public.view_bi_financeiro CASCADE;

CREATE VIEW public.view_bi_financeiro AS
SELECT c.id,
    c.projeto_id,
    p.codigo AS projeto_codigo,
    p.nome AS projeto_nome,
    p.area_id,
    a.nome AS area_nome,
    c.descricao,
    c.valor,
    c.categoria_erp,
    c.categoria_interna,
    c.centro_custo,
    c.data_competencia,
    c.data_pagamento,
    c.status_erp,
    c.site_id,
    s.codigo AS site_codigo,
    s.nome AS site_nome,
    EXTRACT(year FROM c.data_competencia)::integer AS ano,
    EXTRACT(month FROM c.data_competencia)::integer AS mes,
    CASE EXTRACT(quarter FROM c.data_competencia)::integer
        WHEN 1 THEN 'Q1'::text
        WHEN 2 THEN 'Q2'::text
        WHEN 3 THEN 'Q3'::text
        WHEN 4 THEN 'Q4'::text
        ELSE NULL::text
    END AS trimestre
FROM custo_real_erp c
    LEFT JOIN projetos p ON p.id = c.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN sites s ON s.id = c.site_id;

-- Recriar view_bi_producao adicionando area_id e area_nome
DROP VIEW IF EXISTS public.view_bi_producao CASCADE;

CREATE VIEW public.view_bi_producao AS
SELECT dp.id,
    do2.data AS data_producao,
    do2.site_id,
    s.codigo AS site_codigo,
    s.nome AS site_nome,
    p.id AS projeto_id,
    p.codigo AS projeto_codigo,
    p.nome AS projeto_nome,
    p.area_id,
    a.nome AS area_nome,
    il.id AS item_lpu_id,
    il.codigo AS item_codigo,
    il.descricao AS item_descricao,
    il.unidade,
    dp.quantidade,
    dp.preco_unitario_congelado,
    dp.valor_total,
    do2.clima,
    do2.uf,
    do2.municipio,
    EXTRACT(year FROM do2.data)::integer AS ano,
    EXTRACT(month FROM do2.data)::integer AS mes
FROM diario_producao dp
    JOIN diarios_obra do2 ON do2.id = dp.diario_id
    JOIN sites s ON s.id = do2.site_id
    JOIN projetos p ON p.id = s.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    JOIN itens_lpu il ON il.id = dp.item_lpu_id;