-- Drop dependent views first to avoid dependency errors
DROP VIEW IF EXISTS public.view_producao CASCADE;
DROP VIEW IF EXISTS public.view_producao_diario CASCADE;
DROP VIEW IF EXISTS public.view_bi_producao CASCADE;

-- Recreate view_bi_producao with consolidated logic
CREATE VIEW public.view_bi_producao AS
WITH consolidated_production AS (
    -- 1. Daily Reports (Primary source)
    SELECT 
        dp.id,
        d.data AS data_producao,
        d.site_id,
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
        d.clima,
        d.uf,
        d.municipio,
        'diario'::text AS origem
    FROM diario_producao dp
    JOIN diarios_obra d ON d.id = dp.diario_id
    JOIN sites s ON s.id = d.site_id
    JOIN projetos p ON p.id = s.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    JOIN itens_lpu il ON il.id = dp.item_lpu_id

    UNION ALL

    -- 2. Manual Launches (Only if not already in a Daily Report for same site/date/item)
    SELECT 
        lm.id,
        lm.data_medicao AS data_producao,
        lm.site_id,
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
        lm.quantidade,
        il.preco_unitario AS preco_unitario_congelado,
        (lm.quantidade * il.preco_unitario) AS valor_total,
        NULL::text AS clima,
        s.uf,
        s.municipio,
        'manual'::text AS origem
    FROM lancamentos_medicao lm
    JOIN sites s ON s.id = lm.site_id
    JOIN projetos p ON p.id = s.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    JOIN itens_lpu il ON il.id = lm.item_lpu_id
    WHERE NOT EXISTS (
        SELECT 1 
        FROM diario_producao dp2
        JOIN diarios_obra d2 ON d2.id = dp2.diario_id
        WHERE d2.site_id = lm.site_id 
          AND d2.data = lm.data_medicao 
          AND dp2.item_lpu_id = lm.item_lpu_id
    )

    UNION ALL

    -- 3. Production Launches (If table exists and has data)
    SELECT 
        lp.id,
        lp.data_producao,
        lp.site_id,
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
        lp.quantidade,
        il.preco_unitario AS preco_unitario_congelado,
        (lp.quantidade * il.preco_unitario) AS valor_total,
        NULL::text AS clima,
        s.uf,
        s.municipio,
        'lancamento'::text AS origem
    FROM lancamentos_producao lp
    JOIN sites s ON s.id = lp.site_id
    JOIN projetos p ON p.id = s.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    JOIN itens_lpu il ON il.id = lp.item_lpu_id
    WHERE NOT EXISTS (
        SELECT 1 
        FROM diario_producao dp3
        JOIN diarios_obra d3 ON d3.id = dp3.diario_id
        WHERE d3.site_id = lp.site_id 
          AND d3.data = lp.data_producao 
          AND dp3.item_lpu_id = lp.item_lpu_id
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM lancamentos_medicao lm2
        WHERE lm2.site_id = lp.site_id 
          AND lm2.data_medicao = lp.data_producao 
          AND lm2.item_lpu_id = lp.item_lpu_id
    )
)
SELECT 
    *,
    EXTRACT(year FROM data_producao)::integer AS ano,
    EXTRACT(month FROM data_producao)::integer AS mes
FROM consolidated_production;

-- Update view_producao to use the new view_bi_producao
CREATE VIEW public.view_producao AS
SELECT * FROM public.view_bi_producao;

-- Update view_producao_diario to use the new view_bi_producao
CREATE VIEW public.view_producao_diario AS
SELECT 
    id,
    site_id,
    site_codigo,
    site_nome,
    projeto_id,
    projeto_codigo,
    projeto_nome,
    NULL::uuid as empresa_id,
    item_lpu_id,
    item_codigo,
    item_descricao,
    unidade as item_unidade,
    preco_unitario_congelado as preco_unitario,
    quantidade,
    valor_total as valor_produzido,
    data_producao,
    ano,
    mes,
    origem
FROM public.view_bi_producao;

-- Recreate view_bi_analise_obras since it was likely dropped by CASCADE
CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
WITH meses AS (
    SELECT DISTINCT first_of_month(x.d) AS mes
    FROM (
        SELECT data_competencia AS d FROM custo_real_erp
        UNION ALL
        SELECT data_producao AS d FROM public.view_bi_producao
        UNION ALL
        SELECT data_emissao AS d FROM faturamentos
    ) x
    WHERE x.d IS NOT NULL
),
projetos_base AS (
    SELECT 
        p.id AS projeto_id,
        p.codigo AS projeto_codigo,
        p.nome AS projeto_nome,
        p.status AS projeto_status,
        p.valor_total AS projeto_valor_total,
        p.empresa_id,
        e.nome AS empresa_nome,
        p.area_id,
        a.nome AS area_nome,
        p.cliente_id,
        c.razao_social AS cliente_razao_social,
        c.cnpj AS cliente_cnpj
    FROM projetos p
    LEFT JOIN empresas e ON e.id = p.empresa_id
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN clientes c ON c.id = p.cliente_id
),
matriz AS (
    SELECT pb.*, m.mes
    FROM projetos_base pb
    CROSS JOIN meses m
),
producao_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_producao) AS mes,
        sum(valor_total) AS producao_valor,
        sum(quantidade) AS producao_quantidade,
        count(DISTINCT id) FILTER (WHERE origem = 'diario') AS dias_com_diario
    FROM public.view_bi_producao
    GROUP BY projeto_id, first_of_month(data_producao)
),
custo_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_competencia) AS mes,
        sum(valor) AS custo_erp_total,
        sum(CASE WHEN mce.categoria_interna = 'mao_de_obra' THEN valor ELSE 0 END) AS custo_mao_de_obra,
        sum(CASE WHEN mce.categoria_interna = 'materiais' THEN valor ELSE 0 END) AS custo_materiais,
        sum(CASE WHEN mce.categoria_interna = 'equipamentos' THEN valor ELSE 0 END) AS custo_equipamentos,
        sum(CASE WHEN mce.categoria_interna = 'transporte' THEN valor ELSE 0 END) AS custo_transporte,
        sum(CASE WHEN mce.categoria_interna = 'indiretos' THEN valor ELSE 0 END) AS custo_indiretos,
        sum(CASE WHEN mce.categoria_interna = 'financeiros' THEN valor ELSE 0 END) AS custo_financeiros,
        sum(CASE WHEN mce.categoria_interna NOT IN ('mao_de_obra','materiais','equipamentos','transporte','indiretos','financeiros') THEN valor ELSE 0 END) AS custo_outros
    FROM custo_real_erp cre
    LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
    WHERE COALESCE(mce.ativo, true) = true
    GROUP BY projeto_id, first_of_month(data_competencia)
),
faturamento_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        sum(valor_bruto) AS faturamento_bruto,
        sum(valor_liquido) AS faturamento_liquido,
        count(*) AS qtd_faturas
    FROM faturamentos
    GROUP BY projeto_id, first_of_month(data_emissao)
)
SELECT 
    m.*,
    COALESCE(p.producao_valor, 0) AS producao_valor,
    COALESCE(p.producao_quantidade, 0) AS producao_quantidade,
    COALESCE(p.dias_com_diario, 0) AS dias_com_diario,
    COALESCE(c.custo_erp_total, 0) AS custo_erp_total,
    COALESCE(c.custo_mao_de_obra, 0) AS custo_mao_de_obra,
    COALESCE(c.custo_materiais, 0) AS custo_materiais,
    COALESCE(c.custo_equipamentos, 0) AS custo_equipamentos,
    COALESCE(c.custo_transporte, 0) AS custo_transporte,
    COALESCE(c.custo_indiretos, 0) AS custo_indiretos,
    COALESCE(c.custo_financeiros, 0) AS custo_financeiros,
    COALESCE(c.custo_outros, 0) AS custo_outros,
    COALESCE(f.faturamento_bruto, 0) AS faturamento_bruto,
    COALESCE(f.faturamento_liquido, 0) AS faturamento_liquido,
    COALESCE(f.qtd_faturas, 0) AS qtd_faturas,
    (COALESCE(p.producao_valor, 0) - COALESCE(c.custo_erp_total, 0)) AS margem_bruta,
    CASE 
        WHEN COALESCE(p.producao_valor, 0) > 0 THEN 
            ((COALESCE(p.producao_valor, 0) - COALESCE(c.custo_erp_total, 0)) / p.producao_valor) * 100
        ELSE 0 
    END AS margem_bruta_percent,
    EXTRACT(year FROM m.mes)::integer AS ano,
    EXTRACT(month FROM m.mes)::integer AS mes_numero,
    to_char(m.mes, 'YYYY-MM') AS ano_mes
FROM matriz m
LEFT JOIN producao_mes p ON p.projeto_id = m.projeto_id AND p.mes = m.mes
LEFT JOIN custo_mes c ON c.projeto_id = m.projeto_id AND c.mes = m.mes
LEFT JOIN faturamento_mes f ON f.projeto_id = m.projeto_id AND f.mes = m.mes
WHERE COALESCE(p.producao_valor, 0) > 0 OR COALESCE(c.custo_erp_total, 0) > 0 OR COALESCE(f.faturamento_bruto, 0) > 0;
