-- Drop para garantir a mudança de estrutura (colunas removidas)
DROP VIEW IF EXISTS public.view_bi_analise_obras;

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
        SUM(valor_total) AS producao_valor,
        SUM(quantidade) AS producao_quantidade,
        COUNT(DISTINCT id) FILTER (WHERE origem = 'diario') AS dias_com_diario
    FROM view_bi_producao
    GROUP BY projeto_id, first_of_month(data_producao)
), 
custo_mes_detalhado AS (
    SELECT 
        cre.projeto_id,
        first_of_month(cre.data_competencia) AS mes,
        cre.categoria_erp,
        mce.categoria_interna,
        cre.categoria_sugerida_ia AS categoria_ia,
        SUM(cre.valor) AS custo_erp_total
    FROM custo_real_erp cre
    LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
    WHERE COALESCE(mce.ativo, true) = true
    GROUP BY cre.projeto_id, first_of_month(cre.data_competencia), cre.categoria_erp, mce.categoria_interna, cre.categoria_sugerida_ia
), 
faturamento_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        SUM(valor_bruto) AS faturamento_bruto,
        SUM(valor_liquido) AS faturamento_liquido,
        COUNT(*) AS faturas_qtd
    FROM faturamentos
    GROUP BY projeto_id, first_of_month(data_emissao)
), 
all_data AS (
    SELECT projeto_id, mes, categoria_erp, categoria_interna, categoria_ia FROM custo_mes_detalhado
    UNION
    SELECT projeto_id, mes, NULL, NULL, NULL FROM producao_mes
    UNION
    SELECT projeto_id, mes, NULL, NULL, NULL FROM faturamento_mes
)
SELECT 
    pb.*,
    ad.mes,
    ad.categoria_erp,
    ad.categoria_interna,
    ad.categoria_ia,
    COALESCE(cmd.custo_erp_total, 0) AS custo_erp_total,
    COALESCE(pm.producao_valor, 0) AS producao_valor,
    COALESCE(pm.producao_quantidade, 0) AS producao_quantidade,
    COALESCE(pm.dias_com_diario, 0) AS dias_com_diario,
    COALESCE(fm.faturamento_bruto, 0) AS faturamento_bruto,
    COALESCE(fm.faturamento_liquido, 0) AS faturamento_liquido,
    COALESCE(fm.faturas_qtd, 0) AS faturas_qtd
FROM all_data ad
JOIN projetos_base pb ON pb.projeto_id = ad.projeto_id
LEFT JOIN producao_mes pm ON pm.projeto_id = ad.projeto_id AND pm.mes = ad.mes
LEFT JOIN custo_mes_detalhado cmd ON cmd.projeto_id = ad.projeto_id AND cmd.mes = ad.mes 
    AND (cmd.categoria_erp = ad.categoria_erp OR (cmd.categoria_erp IS NULL AND ad.categoria_erp IS NULL))
LEFT JOIN faturamento_mes fm ON fm.projeto_id = ad.projeto_id AND fm.mes = ad.mes;