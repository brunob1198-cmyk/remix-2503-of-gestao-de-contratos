-- Primeiro, vamos garantir que temos a função first_of_month se ela não existir
CREATE OR REPLACE FUNCTION public.first_of_month(d timestamp with time zone)
RETURNS date AS $$
BEGIN
  RETURN date_trunc('month', d)::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.first_of_month(d date)
RETURNS date AS $$
BEGIN
  RETURN date_trunc('month', d)::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop da view existente para recriá-la com a nova estrutura
DROP VIEW IF EXISTS public.view_bi_analise_obras;

CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
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
        SUM(valor_total) AS producao_bruta, -- POC
        SUM(quantidade) AS producao_quantidade
    FROM view_bi_producao
    GROUP BY projeto_id, first_of_month(data_producao)
),
custo_mes_detalhado AS (
    SELECT 
        cre.projeto_id,
        first_of_month(cre.data_competencia) AS mes,
        cre.categoria_erp,
        COALESCE(cre.categoria_interna, mce.categoria_interna, 'Sem Categoria') AS categoria_interna,
        cre.categoria_analise,
        SUM(cre.valor) AS custo_real
    FROM custo_real_erp cre
    LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
    WHERE (mce.ativo IS NULL OR mce.ativo = true)
      AND cre.categoria_erp IS NOT NULL 
      AND TRIM(cre.categoria_erp) <> ''
    GROUP BY cre.projeto_id, first_of_month(cre.data_competencia), cre.categoria_erp, COALESCE(cre.categoria_interna, mce.categoria_interna, 'Sem Categoria'), cre.categoria_analise
),
faturamento_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        SUM(valor_bruto) AS faturamento_bruto,
        SUM(valor_liquido) AS faturamento_liquido
    FROM faturamentos
    GROUP BY projeto_id, first_of_month(data_emissao)
),
mkp_base AS (
    SELECT 
        projeto_id,
        perc_custo_direto,
        perc_risco,
        perc_inflacao,
        perc_gerencia,
        perc_mb_esperado
    FROM mkp_parametros
),
impostos_base AS (
    SELECT 
        projeto_id,
        perc_issqn,
        perc_pis,
        perc_cofins,
        perc_inss,
        perc_dara,
        perc_icms,
        perc_irpj,
        perc_csll,
        perc_total_impostos
    FROM projeto_impostos
),
all_combinations AS (
    SELECT pb.projeto_id, m.mes
    FROM projetos_base pb
    CROSS JOIN meses m
),
final_data AS (
    SELECT 
        ac.projeto_id,
        ac.mes,
        pb.projeto_codigo,
        pb.projeto_nome,
        pb.area_nome,
        pb.cliente_razao_social AS cliente,
        COALESCE(pm.producao_bruta, 0) AS poc,
        COALESCE(imp.perc_total_impostos, 0) AS perc_impostos,
        COALESCE(imp.perc_issqn, 0) AS perc_issqn,
        COALESCE(imp.perc_pis, 0) AS perc_pis,
        COALESCE(imp.perc_cofins, 0) AS perc_cofins,
        COALESCE(imp.perc_inss, 0) AS perc_inss,
        COALESCE(imp.perc_dara, 0) AS perc_dara,
        COALESCE(imp.perc_icms, 0) AS perc_icms,
        COALESCE(imp.perc_irpj, 0) AS perc_irpj,
        COALESCE(imp.perc_csll, 0) AS perc_csll,
        COALESCE(pm.producao_bruta, 0) * (1 - COALESCE(imp.perc_total_impostos, 0)) AS producao_liquida,
        
        -- Detalhamento de Custo Direto (Real)
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'DIRETO' AND categoria_interna = 'Mão de Obra'), 0) AS mo_obra,
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'DIRETO' AND categoria_interna = 'Materiais'), 0) AS materiais,
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'DIRETO' AND categoria_interna = 'Transporte'), 0) AS transporte,
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'DIRETO' AND categoria_interna = 'Indiretos'), 0) AS indiretos,
        
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'DIRETO'), 0) AS custo_direto_real,
        
        -- Custo Direto Orçado
        COALESCE(pm.producao_bruta, 0) * (COALESCE(mkp.perc_custo_direto, 0) + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_inflacao, 0)) AS custo_direto_orcado,
        
        -- Gerência
        COALESCE((SELECT SUM(custo_real) FROM custo_mes_detalhado WHERE projeto_id = ac.projeto_id AND mes = ac.mes AND categoria_analise = 'GERENCIA'), 0) AS gerencia_real,
        (COALESCE(pm.producao_bruta, 0) * (COALESCE(mkp.perc_custo_direto, 0) + COALESCE(mkp.perc_risco, 0) + COALESCE(mkp.perc_inflacao, 0))) * COALESCE(mkp.perc_gerencia, 0) AS gerencia_orcada,
        
        -- Totais
        COALESCE(mkp.perc_mb_esperado, 0) AS perc_mb_mkp
    FROM all_combinations ac
    JOIN projetos_base pb ON pb.projeto_id = ac.projeto_id
    LEFT JOIN producao_mes pm ON pm.projeto_id = ac.projeto_id AND pm.mes = ac.mes
    LEFT JOIN mkp_base mkp ON mkp.projeto_id = ac.projeto_id
    LEFT JOIN impostos_base imp ON imp.projeto_id = ac.projeto_id
)
SELECT 
    *,
    custo_direto_real + gerencia_real AS custo_total_real,
    custo_direto_orcado + gerencia_orcada AS custo_total_orcado,
    custo_direto_orcado - custo_direto_real AS delta_direto,
    gerencia_orcada - gerencia_real AS delta_gerencia,
    (custo_direto_orcado + gerencia_orcada) - (custo_direto_real + gerencia_real) AS resultado_total,
    producao_liquida - (custo_direto_orcado + gerencia_orcada) AS mb_orcada,
    producao_liquida - (custo_direto_real + gerencia_real) AS mb_realizada
FROM final_data
WHERE poc > 0 OR custo_direto_real > 0 OR gerencia_real > 0;

-- Adicionar permissões
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated;
