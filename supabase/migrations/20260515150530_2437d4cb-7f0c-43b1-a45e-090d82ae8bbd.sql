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
producao_mes_detalhada AS (
    SELECT 
        s.projeto_id,
        first_of_month(d_o.data) AS mes,
        sum(dp.valor_total) AS poc,
        sum(CASE WHEN lpu.bdi > 0 THEN dp.valor_total / lpu.bdi ELSE dp.valor_total END) AS custo_direto_orcado_producao
    FROM diario_producao dp
    JOIN diarios_obra d_o ON d_o.id = dp.diario_id
    JOIN sites s ON s.id = d_o.site_id
    LEFT JOIN itens_lpu lpu ON lpu.id = dp.item_lpu_id
    GROUP BY s.projeto_id, first_of_month(d_o.data)
), 
custos_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_competencia) AS mes,
        sum(CASE WHEN categoria_interna = 'Mão de Obra' AND categoria_analise = 'DIRETO' THEN valor ELSE 0 END) AS mo_obra,
        sum(CASE WHEN categoria_interna = 'Materiais' AND categoria_analise = 'DIRETO' THEN valor ELSE 0 END) AS materiais,
        sum(CASE WHEN categoria_interna = 'Transporte' AND categoria_analise = 'DIRETO' THEN valor ELSE 0 END) AS transporte,
        sum(CASE WHEN categoria_interna = 'Indiretos' AND categoria_analise = 'DIRETO' THEN valor ELSE 0 END) AS indiretos,
        sum(CASE WHEN categoria_interna = 'Gerência' THEN valor ELSE 0 END) AS gerencia_real,
        sum(CASE WHEN categoria_interna NOT IN ('Gerência', 'Financeiros') THEN valor ELSE 0 END) AS custo_direto_real,
        sum(valor) AS custo_total_real
    FROM custo_real_erp
    WHERE categoria_erp IS NOT NULL AND TRIM(categoria_erp) <> ''
    GROUP BY projeto_id, first_of_month(data_competencia)
), 
mkp_base AS (
    SELECT 
        projeto_id,
        COALESCE(perc_custo_direto, 0) AS perc_custo_direto,
        COALESCE(perc_risco, 0) AS perc_risco,
        COALESCE(perc_inflacao, 0) AS perc_inflacao,
        COALESCE(perc_gerencia, 0) AS perc_gerencia,
        COALESCE(perc_mb_esperado, 0) AS perc_mb_esperado,
        COALESCE(perc_treinamento, 0) AS perc_treinamento
    FROM mkp_parametros
), 
impostos_base AS (
    SELECT 
        projeto_id,
        COALESCE(perc_total_impostos, 0) AS perc_total_impostos,
        COALESCE(perc_issqn, 0) AS perc_issqn,
        COALESCE(perc_pis, 0) AS perc_pis,
        COALESCE(perc_cofins, 0) AS perc_cofins,
        COALESCE(perc_inss, 0) AS perc_inss,
        COALESCE(perc_dara, 0) AS perc_dara,
        COALESCE(perc_icms, 0) AS perc_icms,
        COALESCE(perc_irpj, 0) AS perc_irpj,
        COALESCE(perc_csll, 0) AS perc_csll
    FROM projeto_impostos
),
all_combinations AS (
    SELECT pb.projeto_id, m.mes
    FROM projetos_base pb
    CROSS JOIN meses m
)
SELECT 
    ac.projeto_id,
    ac.mes,
    pb.projeto_codigo,
    pb.projeto_nome,
    pb.area_nome,
    pb.cliente_razao_social AS cliente,
    COALESCE(pm.poc, 0) AS poc,
    COALESCE(imp.perc_total_impostos, 0) AS perc_impostos,
    COALESCE(pm.poc * (1 - imp.perc_total_impostos), 0) AS receita_liquida,
    COALESCE(cm.mo_obra, 0) AS mo_obra,
    COALESCE(cm.materiais, 0) AS materiais,
    COALESCE(cm.transporte, 0) AS transporte,
    COALESCE(cm.indiretos, 0) AS indiretos,
    COALESCE(cm.custo_direto_real, 0) AS custo_direto_real,
    COALESCE(pm.custo_direto_orcado_producao, 0) AS custo_direto_orcado,
    COALESCE(pm.custo_direto_orcado_producao - cm.custo_direto_real, 0) AS resultado_direto,
    COALESCE(cm.gerencia_real, 0) AS gerencia_real,
    COALESCE(pm.custo_direto_orcado_producao * mkp.perc_gerencia, 0) AS gerencia_orcada,
    (COALESCE(pm.custo_direto_orcado_producao, 0) * (1 + mkp.perc_risco + mkp.perc_gerencia + mkp.perc_treinamento) * (1 + mkp.perc_inflacao)) AS custo_total_orcado,
    COALESCE(cm.custo_total_real, 0) AS custo_total_real,
    COALESCE(pm.poc * (1 - imp.perc_total_impostos) - cm.custo_total_real, 0) AS mb_real,
    mkp.perc_mb_esperado AS perc_mb_mkp
FROM all_combinations ac
JOIN projetos_base pb ON pb.projeto_id = ac.projeto_id
LEFT JOIN producao_mes_detalhada pm ON pm.projeto_id = ac.projeto_id AND pm.mes = ac.mes
LEFT JOIN custos_mes cm ON cm.projeto_id = ac.projeto_id AND cm.mes = ac.mes
LEFT JOIN mkp_base mkp ON mkp.projeto_id = ac.projeto_id
LEFT JOIN impostos_base imp ON imp.projeto_id = ac.projeto_id
WHERE COALESCE(pm.poc, 0) > 0 OR COALESCE(cm.custo_total_real, 0) > 0;