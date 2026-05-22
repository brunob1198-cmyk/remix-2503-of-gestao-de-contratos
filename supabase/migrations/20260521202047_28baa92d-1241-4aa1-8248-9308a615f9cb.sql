CREATE OR REPLACE VIEW public.view_quadro_geral_bi AS
WITH contratos_resumo AS (
    -- Consolidar valor total de contratos (Pai + Aditivos)
    SELECT 
        c.id as contrato_id,
        COALESCE(c.valor_total, 0) + COALESCE((SELECT SUM(a.valor_total) FROM contratos a WHERE a.contrato_pai_id = c.id), 0) as valor_consolidado
    FROM contratos c
    WHERE c.contrato_pai_id IS NULL
),
projeto_contratos AS (
    -- Projetos podem ter múltiplos contratos vinculados
    SELECT 
        p.id as projeto_id,
        SUM(cr.valor_consolidado) as valor_contratos_vinculados
    FROM projetos p
    CROSS JOIN LATERAL unnest(COALESCE(p.contrato_ids, ARRAY[]::uuid[])) as cid
    JOIN contratos_resumo cr ON cr.contrato_id = cid
    GROUP BY p.id
),
executado_diarios AS (
    -- Valor executado via diários de obra
    SELECT 
        s.projeto_id,
        d.site_id,
        SUM(dp.valor_total) as valor_executado
    FROM diarios_obra d
    JOIN sites s ON s.id = d.site_id
    JOIN diario_producao dp ON dp.diario_id = d.id
    GROUP BY 1, 2
),
executado_lancamentos AS (
    -- Valor executado via lançamentos manuais (usando preço da LPU atual como referência)
    SELECT 
        lp.site_id,
        SUM(lp.quantidade * COALESCE(il.preco_unitario, 0)) as valor_executado
    FROM lancamentos_producao lp
    JOIN itens_lpu il ON il.id = lp.item_lpu_id
    GROUP BY 1
),
faturado_resumo AS (
    -- Valor faturado por site
    SELECT 
        lf.site_id,
        SUM(COALESCE(lf.valor_faturado, lf.quantidade * COALESCE(il.preco_unitario, 0))) as valor_faturado
    FROM lancamentos_faturamento lf
    JOIN itens_lpu il ON il.id = lf.item_lpu_id
    GROUP BY 1
),
site_metrics AS (
    -- Métricas consolidadas por Site
    SELECT 
        s.id as site_id,
        s.projeto_id,
        s.codigo as site_codigo,
        s.nome as site_nome,
        COALESCE(ed.valor_executado, 0) + COALESCE(el.valor_executado, 0) as valor_executado_site,
        COALESCE(fr.valor_faturado, 0) as valor_faturado_site
    FROM sites s
    LEFT JOIN (
        SELECT site_id, SUM(valor_executado) as valor_executado FROM executado_diarios GROUP BY site_id
    ) ed ON ed.site_id = s.id
    LEFT JOIN executado_lancamentos el ON el.site_id = s.id
    LEFT JOIN faturado_resumo fr ON fr.site_id = s.id
)
SELECT 
    a.nome as "Área",
    p.cliente as "Cliente",
    p.codigo as "Projeto Código",
    p.nome as "Projeto Nome",
    p.status as "Status Projeto",
    sm.site_codigo as "Site Código",
    sm.site_nome as "Site Nome",
    -- Valor do Contrato (prioriza soma de contratos vinculados, fallback para p.valor_total)
    COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0) as "Valor Contrato",
    sm.valor_executado_site as "Valor Executado",
    sm.valor_faturado_site as "Valor Faturado",
    (sm.valor_executado_site - sm.valor_faturado_site) as "Valor Não Faturado",
    GREATEST(0, COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0) - sm.valor_executado_site) as "Saldo Contrato",
    CASE 
        WHEN COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0) > 0 
        THEN (sm.valor_executado_site / COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0)) * 100 
        ELSE 0 
    END as "% Evolução"
FROM projetos p
LEFT JOIN areas a ON a.id = p.area_id
LEFT JOIN projeto_contratos pc ON pc.projeto_id = p.id
LEFT JOIN site_metrics sm ON sm.projeto_id = p.id;

-- Garantir acesso público para a view
GRANT SELECT ON public.view_quadro_geral_bi TO anon, authenticated;