-- Remover views dependentes para permitir alteração da estrutura
DROP VIEW IF EXISTS public.view_bi_analise_obras;
DROP VIEW IF EXISTS public.view_producao;
DROP VIEW IF EXISTS public.view_bi_producao;

-- Função auxiliar para truncar meses de forma consistente
CREATE OR REPLACE FUNCTION public.first_of_month(d date) 
RETURNS date AS $$
  SELECT date_trunc('month', d)::date;
$$ LANGUAGE sql IMMUTABLE;

-- Criar view_bi_producao unificada
CREATE OR REPLACE VIEW public.view_bi_producao AS
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
    EXTRACT(year FROM d.data)::integer AS ano,
    EXTRACT(month FROM d.data)::integer AS mes,
    'diario' as origem
FROM diario_producao dp
JOIN diarios_obra d ON d.id = dp.diario_id
JOIN sites s ON s.id = d.site_id
JOIN projetos p ON p.id = s.projeto_id
LEFT JOIN areas a ON a.id = p.area_id
JOIN itens_lpu il ON il.id = dp.item_lpu_id
UNION ALL
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
    il.preco_unitario as preco_unitario_congelado,
    (lp.quantidade * il.preco_unitario) as valor_total,
    NULL as clima,
    lp.uf,
    lp.municipio,
    EXTRACT(year FROM lp.data_producao)::integer AS ano,
    EXTRACT(month FROM lp.data_producao)::integer AS mes,
    'lancamento' as origem
FROM lancamentos_producao lp
JOIN sites s ON s.id = lp.site_id
JOIN projetos p ON p.id = s.projeto_id
LEFT JOIN areas a ON a.id = p.area_id
JOIN itens_lpu il ON il.id = lp.item_lpu_id;

-- Recriar view_bi_analise_obras
CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
WITH meses AS (
    SELECT DISTINCT first_of_month(d) AS mes
    FROM (
        SELECT data_competencia AS d FROM custo_real_erp WHERE data_competencia IS NOT NULL
        UNION ALL
        SELECT data AS d FROM diarios_obra
        UNION ALL
        SELECT data_emissao AS d FROM faturamentos
        UNION ALL
        SELECT data_medicao AS d FROM lancamentos_medicao
        UNION ALL
        SELECT data_producao AS d FROM lancamentos_producao
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
erp_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_competencia) AS mes,
        SUM(valor) AS custo_erp_total,
        SUM(CASE WHEN mce.categoria_interna = 'mao_de_obra' THEN valor ELSE 0 END) AS custo_mao_de_obra,
        SUM(CASE WHEN mce.categoria_interna = 'materiais' THEN valor ELSE 0 END) AS custo_materiais,
        SUM(CASE WHEN mce.categoria_interna = 'equipamentos' THEN valor ELSE 0 END) AS custo_equipamentos,
        SUM(CASE WHEN mce.categoria_interna = 'transporte' THEN valor ELSE 0 END) AS custo_transporte,
        SUM(CASE WHEN mce.categoria_interna = 'indiretos' THEN valor ELSE 0 END) AS custo_indiretos,
        SUM(CASE WHEN mce.categoria_interna = 'financeiros' THEN valor ELSE 0 END) AS custo_financeiros,
        SUM(CASE WHEN mce.categoria_interna NOT IN ('mao_de_obra', 'materiais', 'equipamentos', 'transporte', 'indiretos', 'financeiros') THEN valor ELSE 0 END) AS custo_outros
    FROM custo_real_erp cre
    LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
    WHERE projeto_id IS NOT NULL AND data_competencia IS NOT NULL AND COALESCE(mce.ativo, true) = true
    GROUP BY projeto_id, first_of_month(data_competencia)
),
producao_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_producao) AS mes,
        SUM(valor_total) AS valor_produzido,
        SUM(quantidade) AS quantidade_produzida,
        COUNT(DISTINCT id) FILTER (WHERE origem = 'diario') AS dias_com_diario
    FROM view_bi_producao
    GROUP BY projeto_id, first_of_month(data_producao)
),
diario_custos_mes AS (
    SELECT 
        s.projeto_id,
        first_of_month(d.data) AS mes,
        COALESCE(SUM(eq.custo_total), 0) AS custo_diario_equipe,
        COALESCE(SUM(eqp.custo_total), 0) AS custo_diario_equipamentos,
        COALESCE(SUM(vec.custo_diaria), 0) AS custo_diario_veiculos
    FROM diarios_obra d
    JOIN sites s ON s.id = d.site_id
    LEFT JOIN diario_equipe eq ON eq.diario_id = d.id
    LEFT JOIN diario_equipamentos eqp ON eqp.diario_id = d.id
    LEFT JOIN diario_veiculos vec ON vec.diario_id = d.id
    GROUP BY s.projeto_id, first_of_month(d.data)
),
faturamento_mes AS (
    SELECT 
        projeto_id,
        first_of_month(data_emissao) AS mes,
        SUM(valor_bruto) AS faturamento_bruto,
        SUM(valor_liquido) AS faturamento_liquido,
        COUNT(*) AS qtd_faturas
    FROM faturamentos
    GROUP BY projeto_id, first_of_month(data_emissao)
),
medicao_mes AS (
    SELECT 
        s.projeto_id,
        first_of_month(lm.data_medicao) AS mes,
        SUM(lm.quantidade * COALESCE(il.preco_unitario, 0)) AS valor_medido,
        COUNT(DISTINCT lm.numero_medicao) AS qtd_medicoes
    FROM lancamentos_medicao lm
    JOIN sites s ON s.id = lm.site_id
    JOIN itens_lpu il ON il.id = lm.item_lpu_id
    GROUP BY s.projeto_id, first_of_month(lm.data_medicao)
)
SELECT 
    mx.empresa_id,
    mx.empresa_nome,
    mx.area_id,
    mx.area_nome,
    mx.cliente_id,
    mx.cliente_razao_social,
    mx.cliente_cnpj,
    mx.projeto_id,
    mx.projeto_codigo,
    mx.projeto_nome,
    mx.projeto_status,
    mx.projeto_valor_total,
    mx.mes,
    EXTRACT(year FROM mx.mes)::integer AS ano,
    EXTRACT(month FROM mx.mes)::integer AS mes_numero,
    to_char(mx.mes, 'YYYY-MM') AS ano_mes,
    COALESCE(erp.custo_erp_total, 0) AS custo_erp_total,
    COALESCE(erp.custo_mao_de_obra, 0) AS custo_mao_de_obra,
    COALESCE(erp.custo_materiais, 0) AS custo_materiais,
    COALESCE(erp.custo_equipamentos, 0) AS custo_equipamentos,
    COALESCE(erp.custo_transporte, 0) AS custo_transporte,
    COALESCE(erp.custo_indiretos, 0) AS custo_indiretos,
    COALESCE(erp.custo_financeiros, 0) AS custo_financeiros,
    COALESCE(erp.custo_outros, 0) AS custo_outros,
    COALESCE(dc.custo_diario_equipe, 0) AS custo_diario_equipe,
    COALESCE(dc.custo_diario_equipamentos, 0) AS custo_diario_equipamentos,
    COALESCE(dc.custo_diario_veiculos, 0) AS custo_diario_veiculos,
    (COALESCE(dc.custo_diario_equipe, 0) + COALESCE(dc.custo_diario_equipamentos, 0) + COALESCE(dc.custo_diario_veiculos, 0)) AS custo_diario_total,
    CASE 
        WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
        ELSE (COALESCE(dc.custo_diario_equipe, 0) + COALESCE(dc.custo_diario_equipamentos, 0) + COALESCE(dc.custo_diario_veiculos, 0))
    END AS custo_real_consolidado,
    COALESCE(pm.valor_produzido, 0) AS producao_valor,
    COALESCE(pm.quantidade_produzida, 0) AS producao_quantidade,
    COALESCE(pm.dias_com_diario, 0) AS dias_com_diario,
    COALESCE(fm.faturamento_bruto, 0) AS faturamento_bruto,
    COALESCE(fm.faturamento_liquido, 0) AS faturamento_liquido,
    COALESCE(fm.qtd_faturas, 0) AS qtd_faturas,
    COALESCE(mm.valor_medido, 0) AS valor_medido,
    COALESCE(mm.qtd_medicoes, 0) AS qtd_medicoes,
    (COALESCE(pm.valor_produzido, 0) - 
        CASE 
            WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
            ELSE (COALESCE(dc.custo_diario_equipe, 0) + COALESCE(dc.custo_diario_equipamentos, 0) + COALESCE(dc.custo_diario_veiculos, 0))
        END
    ) AS margem_bruta,
    CASE 
        WHEN COALESCE(pm.valor_produzido, 0) > 0 THEN 
            ((COALESCE(pm.valor_produzido, 0) - 
                CASE 
                    WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
                    ELSE (COALESCE(dc.custo_diario_equipe, 0) + COALESCE(dc.custo_diario_equipamentos, 0) + COALESCE(dc.custo_diario_veiculos, 0))
                END
            ) / NULLIF(pm.valor_produzido, 0)) * 100
        ELSE 0 
    END AS margem_bruta_percent
FROM matriz mx
LEFT JOIN erp_mes erp ON erp.projeto_id = mx.projeto_id AND erp.mes = mx.mes
LEFT JOIN producao_mes pm ON pm.projeto_id = mx.projeto_id AND pm.mes = mx.mes
LEFT JOIN diario_custos_mes dc ON dc.projeto_id = mx.projeto_id AND dc.mes = mx.mes
LEFT JOIN faturamento_mes fm ON fm.projeto_id = mx.projeto_id AND fm.mes = mx.mes
LEFT JOIN medicao_mes mm ON mm.projeto_id = mx.projeto_id AND mm.mes = mx.mes
WHERE 
    COALESCE(erp.custo_erp_total, 0) > 0 OR 
    COALESCE(pm.valor_produzido, 0) > 0 OR 
    COALESCE(dc.custo_diario_equipe, 0) > 0 OR 
    COALESCE(dc.custo_diario_equipamentos, 0) > 0 OR 
    COALESCE(dc.custo_diario_veiculos, 0) > 0 OR 
    COALESCE(fm.faturamento_bruto, 0) > 0 OR 
    COALESCE(mm.valor_medido, 0) > 0;

-- Criar view_producao como espelho da unificada
CREATE OR REPLACE VIEW public.view_producao AS
SELECT * FROM public.view_bi_producao;

-- Garantir permissões novamente
GRANT SELECT ON public.view_bi_producao TO anon, authenticated, service_role;
GRANT SELECT ON public.view_producao TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated, service_role;
