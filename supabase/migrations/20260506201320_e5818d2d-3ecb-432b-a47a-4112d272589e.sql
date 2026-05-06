-- Remover a view para permitir alteração na ordem das colunas
DROP VIEW IF EXISTS public.view_bi_analise_obras;

-- Criar a view atualizada
CREATE VIEW public.view_bi_analise_obras AS
WITH meses AS (
    SELECT DISTINCT first_of_month(x.d) AS mes
    FROM (
        SELECT data_competencia AS d FROM custo_real_erp
        UNION ALL
        SELECT data_producao AS d FROM view_bi_producao
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
producao_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_producao) AS mes,
        sum(valor_total) AS producao_valor,
        sum(quantidade) AS producao_quantidade,
        count(DISTINCT id) FILTER (WHERE origem = 'diario') AS dias_com_diario
    FROM view_bi_producao
    GROUP BY projeto_id, first_of_month(data_producao)
),
custo_mes_detalhado AS (
    SELECT 
        cre.projeto_id,
        first_of_month(cre.data_competencia) AS mes,
        cre.categoria_erp,
        mce.categoria_interna,
        sum(cre.valor) AS custo_erp_total,
        sum(CASE WHEN mce.categoria_interna = 'mao_de_obra' THEN cre.valor ELSE 0 END) AS custo_mao_de_obra,
        sum(CASE WHEN mce.categoria_interna = 'materiais' THEN cre.valor ELSE 0 END) AS custo_materiais,
        sum(CASE WHEN mce.categoria_interna = 'equipamentos' THEN cre.valor ELSE 0 END) AS custo_equipamentos,
        sum(CASE WHEN mce.categoria_interna = 'transporte' THEN cre.valor ELSE 0 END) AS custo_transporte,
        sum(CASE WHEN mce.categoria_interna = 'indiretos' THEN cre.valor ELSE 0 END) AS custo_indiretos,
        sum(CASE WHEN mce.categoria_interna = 'financeiros' THEN cre.valor ELSE 0 END) AS custo_financeiros,
        sum(CASE WHEN mce.categoria_interna NOT IN ('mao_de_obra', 'materiais', 'equipamentos', 'transporte', 'indiretos', 'financeiros') OR mce.categoria_interna IS NULL THEN cre.valor ELSE 0 END) AS custo_outros
    FROM custo_real_erp cre
    LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
    WHERE COALESCE(mce.ativo, true) = true
    GROUP BY cre.projeto_id, first_of_month(cre.data_competencia), cre.categoria_erp, mce.categoria_interna
),
faturamento_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        sum(valor_bruto) AS faturamento_bruto,
        sum(valor_liquido) AS faturamento_liquido,
        count(*) AS faturas_qtd
    FROM faturamentos
    GROUP BY projeto_id, first_of_month(data_emissao)
),
all_data AS (
    SELECT projeto_id, mes, categoria_erp, categoria_interna FROM custo_mes_detalhado
    UNION
    SELECT projeto_id, mes, NULL as categoria_erp, NULL as categoria_interna FROM producao_mes
    UNION
    SELECT projeto_id, mes, NULL as categoria_erp, NULL as categoria_interna FROM faturamento_mes
)
SELECT 
    pb.projeto_id,
    pb.projeto_codigo,
    pb.projeto_nome,
    pb.projeto_status,
    pb.projeto_valor_total,
    pb.empresa_id,
    pb.empresa_nome,
    pb.area_id,
    pb.area_nome,
    pb.cliente_id,
    pb.cliente_razao_social,
    pb.cliente_cnpj,
    ad.mes,
    ad.categoria_erp,
    ad.categoria_interna,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN p.producao_valor ELSE 0 END, 0) AS producao_valor,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN p.producao_quantidade ELSE 0 END, 0) AS producao_quantidade,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN p.dias_com_diario ELSE 0 END, 0) AS dias_com_diario,
    COALESCE(c.custo_erp_total, 0) AS custo_erp_total,
    COALESCE(c.custo_mao_de_obra, 0) AS custo_mao_de_obra,
    COALESCE(c.custo_materiais, 0) AS custo_materiais,
    COALESCE(c.custo_equipamentos, 0) AS custo_equipamentos,
    COALESCE(c.custo_transporte, 0) AS custo_transporte,
    COALESCE(c.custo_indiretos, 0) AS custo_indiretos,
    COALESCE(c.custo_financeiros, 0) AS custo_financeiros,
    COALESCE(c.custo_outros, 0) AS custo_outros,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN f.faturamento_bruto ELSE 0 END, 0) AS faturamento_bruto,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN f.faturamento_liquido ELSE 0 END, 0) AS faturamento_liquido,
    COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN f.faturas_qtd ELSE 0 END, 0) AS qtd_faturas,
    (COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN p.producao_valor ELSE 0 END, 0) - COALESCE(c.custo_erp_total, 0)) AS margem_bruta,
    CASE 
        WHEN COALESCE(CASE WHEN ad.categoria_erp IS NULL THEN p.producao_valor ELSE 0 END, 0) > 0 
        THEN (COALESCE(p.producao_valor, 0) - COALESCE(c.custo_erp_total, 0)) / p.producao_valor * 100 
        ELSE 0 
    END AS margem_bruta_percent,
    EXTRACT(year FROM ad.mes)::integer AS ano,
    EXTRACT(month FROM ad.mes)::integer AS mes_numero,
    to_char(ad.mes, 'YYYY-MM') AS ano_mes
FROM all_data ad
JOIN projetos_base pb ON pb.projeto_id = ad.projeto_id
LEFT JOIN producao_mes p ON p.projeto_id = ad.projeto_id AND p.mes = ad.mes
LEFT JOIN faturamento_mes f ON f.projeto_id = ad.projeto_id AND f.mes = ad.mes
LEFT JOIN custo_mes_detalhado c ON c.projeto_id = ad.projeto_id AND c.mes = ad.mes AND (c.categoria_erp = ad.categoria_erp OR (c.categoria_erp IS NULL AND ad.categoria_erp IS NULL))
WHERE 
    COALESCE(p.producao_valor, 0) > 0 OR 
    COALESCE(c.custo_erp_total, 0) > 0 OR 
    COALESCE(f.faturamento_bruto, 0) > 0;
