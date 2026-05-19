-- Drop existing view to allow restructuring columns
DROP VIEW IF EXISTS public.view_bi_analise_obras;

CREATE VIEW public.view_bi_analise_obras AS
WITH projetos_base AS (
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
mkp_base AS (
    SELECT 
        projeto_id,
        COALESCE(perc_risco, 0) AS perc_risco,
        COALESCE(perc_inflacao, 0) AS perc_inflacao,
        COALESCE(perc_gerencia, 0) AS perc_gerencia,
        COALESCE(perc_mb_esperado, 0) AS perc_mb_mkp,
        COALESCE(perc_treinamento, 0) AS perc_treinamento,
        COALESCE(perc_custo_direto, 0.7) AS perc_custo_direto,
        COALESCE(bdi_venda, 1.4285) AS bdi_venda
    FROM mkp_parametros
),
producao_mes AS (
    SELECT 
        s.projeto_id,
        first_of_month(d_o.data) AS mes,
        SUM(COALESCE(dp.valor_total, 0)) AS poc,
        SUM(
            CASE 
                WHEN lpu.bdi > 0 THEN COALESCE(dp.valor_total, 0) / lpu.bdi
                WHEN mkp.bdi_venda > 0 THEN COALESCE(dp.valor_total, 0) / mkp.bdi_venda
                ELSE COALESCE(dp.valor_total, 0) * COALESCE(mkp.perc_custo_direto, 0.7)
            END
        ) AS custo_direto_orcado_producao
    FROM diario_producao dp
    JOIN diarios_obra d_o ON d_o.id = dp.diario_id
    JOIN sites s ON s.id = d_o.site_id
    LEFT JOIN itens_lpu lpu ON lpu.id = dp.item_lpu_id
    LEFT JOIN mkp_base mkp ON mkp.projeto_id = s.projeto_id
    GROUP BY s.projeto_id, first_of_month(d_o.data)
),
custo_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_competencia) AS mes,
        SUM(CASE WHEN categoria_interna = 'Mão de Obra' THEN valor ELSE 0 END) AS mo_obra,
        SUM(CASE WHEN categoria_interna = 'Materiais' THEN valor ELSE 0 END) AS materiais,
        SUM(CASE WHEN categoria_interna = 'Equipamentos' THEN valor ELSE 0 END) AS equipamentos,
        SUM(CASE WHEN categoria_interna = 'Transporte' THEN valor ELSE 0 END) AS transporte,
        SUM(CASE WHEN categoria_interna = 'Indiretos' THEN valor ELSE 0 END) AS indiretos,
        SUM(CASE WHEN categoria_interna = 'Financeiros' THEN valor ELSE 0 END) AS financeiros,
        SUM(CASE WHEN categoria_interna = 'Gerência' THEN valor ELSE 0 END) AS gerencia_real,
        SUM(CASE WHEN categoria_interna NOT IN ('Mão de Obra', 'Materiais', 'Equipamentos', 'Transporte', 'Indiretos', 'Financeiros', 'Gerência') THEN valor ELSE 0 END) AS outros,
        SUM(CASE WHEN categoria_interna NOT IN ('Gerência', 'Financeiros') THEN valor ELSE 0 END) AS custo_direto_real,
        SUM(CASE WHEN categoria_interna <> 'Financeiros' THEN valor ELSE 0 END) AS custo_total_real
    FROM custo_real_erp
    WHERE projeto_id IS NOT NULL AND data_competencia IS NOT NULL
    GROUP BY projeto_id, first_of_month(data_competencia)
),
fat_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        SUM(COALESCE(valor_bruto, 0)) AS faturamento_bruto,
        SUM(COALESCE(valor_liquido, 0)) AS faturamento_liquido,
        COUNT(*) AS qtd_faturas
    FROM faturamentos
    WHERE projeto_id IS NOT NULL AND data_emissao IS NOT NULL
    GROUP BY projeto_id, first_of_month(data_emissao)
),
meses AS (
    SELECT projeto_id, mes FROM producao_mes
    UNION
    SELECT projeto_id, mes FROM custo_mes
    UNION
    SELECT projeto_id, mes FROM fat_mes
),
impostos_base AS (
    SELECT 
        projeto_id,
        COALESCE(perc_total_impostos, 0) AS perc_total_impostos
    FROM projeto_impostos
)
SELECT 
    m.projeto_id,
    m.mes,
    EXTRACT(YEAR FROM m.mes)::INTEGER AS ano,
    EXTRACT(MONTH FROM m.mes)::INTEGER AS mes_numero,
    (EXTRACT(YEAR FROM m.mes) * 100 + EXTRACT(MONTH FROM m.mes))::INTEGER AS mes_id,
    TO_CHAR(m.mes, 'YYYY-MM') AS ano_mes,
    TO_CHAR(m.mes, 'MM/YYYY') AS referencia,
    pb.projeto_codigo,
    pb.projeto_nome,
    pb.projeto_status,
    pb.area_id,
    pb.area_nome,
    pb.cliente_id,
    pb.cliente_razao_social AS cliente,
    pb.cliente_cnpj,
    pb.empresa_id,
    pb.empresa_nome,
    
    -- VALORES PRINCIPAIS
    COALESCE(pm.poc, 0)::NUMERIC(18,2) AS poc,
    COALESCE(imp.perc_total_impostos, 0)::NUMERIC(18,4) AS perc_impostos,
    (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)))::NUMERIC(18,2) AS receita_liquida,
    
    -- CUSTOS DIRETOS DETALHADOS
    COALESCE(cm.mo_obra, 0)::NUMERIC(18,2) AS mo_obra,
    COALESCE(cm.materiais, 0)::NUMERIC(18,2) AS materiais,
    COALESCE(cm.transporte, 0)::NUMERIC(18,2) AS transporte,
    COALESCE(cm.equipamentos, 0)::NUMERIC(18,2) AS equipamentos,
    COALESCE(cm.indiretos, 0)::NUMERIC(18,2) AS indiretos,
    COALESCE(cm.outros, 0)::NUMERIC(18,2) AS outros,
    
    -- CUSTO DIRETO TOTAL E ORÇADO
    COALESCE(cm.custo_direto_real, 0)::NUMERIC(18,2) AS custo_direto_real,
    COALESCE(pm.custo_direto_orcado_producao, 0)::NUMERIC(18,2) AS custo_direto_orcado,
    (COALESCE(pm.custo_direto_orcado_producao, 0) - COALESCE(cm.custo_direto_real, 0))::NUMERIC(18,2) AS resultado_direto,
    
    -- PERCENTUAIS CUSTO DIRETO
    CASE 
        WHEN COALESCE(pm.poc, 0) > 0 THEN (COALESCE(pm.custo_direto_orcado_producao, 0) / COALESCE(pm.poc, 0))
        ELSE COALESCE(mkp.perc_custo_direto, 0.7)
    END::NUMERIC(18,4) AS perc_custo_direto_orcado,
    CASE 
        WHEN COALESCE(pm.poc, 0) > 0 THEN (COALESCE(cm.custo_direto_real, 0) / COALESCE(pm.poc, 0))
        ELSE 0
    END::NUMERIC(18,4) AS perc_custo_direto_real,
    
    -- GERÊNCIA
    COALESCE(cm.gerencia_real, 0)::NUMERIC(18,2) AS gerencia_real,
    (COALESCE(pm.custo_direto_orcado_producao, 0) * COALESCE(mkp.perc_gerencia, 0))::NUMERIC(18,2) AS gerencia_orcada,
    (COALESCE(pm.custo_direto_orcado_producao, 0) * COALESCE(mkp.perc_gerencia, 0) - COALESCE(cm.gerencia_real, 0))::NUMERIC(18,2) AS gerencia_resultado,
    CASE 
        WHEN COALESCE(cm.custo_direto_real, 0) > 0 THEN (COALESCE(cm.gerencia_real, 0) / COALESCE(cm.custo_direto_real, 0))
        ELSE 0
    END::NUMERIC(18,4) AS perc_gerencia_real,
    COALESCE(mkp.perc_gerencia, 0)::NUMERIC(18,4) AS perc_gerencia_orcada,
    
    -- CUSTO TOTAL
    COALESCE(cm.custo_total_real, 0)::NUMERIC(18,2) AS custo_total_real,
    (COALESCE(pm.custo_direto_orcado_producao, 0) * (1 + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_gerencia, 0)) * (1 + COALESCE(mkp.perc_inflacao, 0) + COALESCE(mkp.perc_treinamento, 0)))::NUMERIC(18,2) AS custo_total_orcado,
    (COALESCE(pm.custo_direto_orcado_producao, 0) * (1 + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_gerencia, 0)) * (1 + COALESCE(mkp.perc_inflacao, 0) + COALESCE(mkp.perc_treinamento, 0)) - COALESCE(cm.custo_total_real, 0))::NUMERIC(18,2) AS resultado_total,
    
    -- MARGEM BRUTA (MB)
    (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)) - (COALESCE(pm.custo_direto_orcado_producao, 0) * (1 + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_gerencia, 0)) * (1 + COALESCE(mkp.perc_inflacao, 0) + COALESCE(mkp.perc_treinamento, 0))))::NUMERIC(18,2) AS mb_orcada,
    (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)) - COALESCE(cm.custo_total_real, 0))::NUMERIC(18,2) AS mb_real,
    
    -- PERCENTUAIS MB
    CASE 
        WHEN (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0))) > 0 
        THEN (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)) - (COALESCE(pm.custo_direto_orcado_producao, 0) * (1 + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_gerencia, 0)) * (1 + COALESCE(mkp.perc_inflacao, 0) + COALESCE(mkp.perc_treinamento, 0)))) / (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)))
        ELSE 0
    END::NUMERIC(18,4) AS perc_mb_orcada,
    CASE 
        WHEN (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0))) > 0 
        THEN (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)) - COALESCE(cm.custo_total_real, 0)) / (COALESCE(pm.poc, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)))
        ELSE 0
    END::NUMERIC(18,4) AS perc_mb_real,
    COALESCE(mkp.perc_mb_mkp, 0)::NUMERIC(18,4) AS perc_mb_mkp,
    
    -- FATURAMENTO
    COALESCE(fm.faturamento_bruto, 0)::NUMERIC(18,2) AS faturamento_bruto,
    COALESCE(fm.faturamento_liquido, 0)::NUMERIC(18,2) AS faturamento_liquido,
    COALESCE(fm.qtd_faturas, 0)::BIGINT AS qtd_faturas,
    COALESCE(cm.financeiros, 0)::NUMERIC(18,2) AS custo_financeiros

FROM meses m
JOIN projetos_base pb ON pb.projeto_id = m.projeto_id
LEFT JOIN producao_mes pm ON pm.projeto_id = m.projeto_id AND pm.mes = m.mes
LEFT JOIN custo_mes cm ON cm.projeto_id = m.projeto_id AND cm.mes = m.mes
LEFT JOIN fat_mes fm ON fm.projeto_id = m.projeto_id AND fm.mes = m.mes
LEFT JOIN mkp_base mkp ON mkp.projeto_id = m.projeto_id
LEFT JOIN impostos_base imp ON imp.projeto_id = m.projeto_id;

-- Grant permissions again
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated, service_role;