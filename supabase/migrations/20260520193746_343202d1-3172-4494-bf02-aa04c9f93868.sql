-- Drop existing view and function to recreate them with new columns
DROP VIEW IF EXISTS public.view_bi_analise_obras;
DROP FUNCTION IF EXISTS public.get_bi_analise_obras();

-- Recreate the helper function with all requested columns
CREATE OR REPLACE FUNCTION public.get_bi_analise_obras()
RETURNS TABLE (
    "Referência" TEXT,
    "Área" TEXT,
    "Projeto" TEXT,
    "Cliente" TEXT,
    "Produção (POC)" NUMERIC,
    "% Impostos" NUMERIC,
    "Receita Líquida" NUMERIC,
    "MO" NUMERIC,
    "Mat." NUMERIC,
    "Transp." NUMERIC,
    "Indir." NUMERIC,
    "Custo Direto Real" NUMERIC,
    "Custo Direto Orçado" NUMERIC,
    "Resultado Direto" NUMERIC,
    "Gerência Real" NUMERIC,
    "Gerência Orçada" NUMERIC,
    "Resultado Gerência" NUMERIC,
    "% Gerência Real" NUMERIC,
    "% Gerência Orç." NUMERIC,
    "Custo Total Real" NUMERIC,
    "Custo Total Orçado" NUMERIC,
    "Resultado Total" NUMERIC,
    "MB Orç. (R$)" NUMERIC,
    "MB Real (R$)" NUMERIC,
    "% MB Orç." NUMERIC,
    "% MB Real" NUMERIC,
    "ID Projeto" UUID,
    "Mês Num" INTEGER,
    "Ano" INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH periodos AS (
        -- Get all project-month combinations that have either costs or production
        SELECT DISTINCT
            p.id AS projeto_id,
            p.nome AS projeto_nome,
            a.nome AS area_nome,
            cl.nome AS cliente_nome,
            date_trunc('month', COALESCE(c.data_competencia, d.data)) AS mes_referencia
        FROM projetos p
        LEFT JOIN areas a ON p.area_id = a.id
        LEFT JOIN clientes cl ON p.cliente_id = cl.id
        LEFT JOIN custo_real_erp c ON p.id = c.projeto_id
        LEFT JOIN sites s ON p.id = s.projeto_id
        LEFT JOIN diarios_obra d ON s.id = d.site_id
        WHERE c.data_competencia IS NOT NULL OR d.data IS NOT NULL
    ),
    custos_mensais AS (
        -- Aggregate costs per project and month
        SELECT 
            c.projeto_id,
            date_trunc('month', c.data_competencia) AS mes_referencia,
            SUM(CASE WHEN c.categoria_interna = 'Mão de Obra' AND c.categoria_analise = 'DIRETO' THEN c.valor ELSE 0 END) AS mo,
            SUM(CASE WHEN c.categoria_interna = 'Materiais' AND c.categoria_analise = 'DIRETO' THEN c.valor ELSE 0 END) AS mat,
            SUM(CASE WHEN c.categoria_interna = 'Transporte' AND c.categoria_analise = 'DIRETO' THEN c.valor ELSE 0 END) AS transp,
            SUM(CASE WHEN c.categoria_interna = 'Indiretos' AND c.categoria_analise = 'DIRETO' THEN c.valor ELSE 0 END) AS indir,
            SUM(CASE WHEN c.categoria_interna NOT IN ('Gerência', 'Financeiros') AND c.categoria_analise = 'DIRETO' THEN c.valor ELSE 0 END) AS custo_direto_real,
            SUM(CASE WHEN c.categoria_interna = 'Gerência' THEN c.valor ELSE 0 END) AS gerencia_real
        FROM custo_real_erp c
        -- Skip specific cost center as in useAnaliseCustos.ts
        WHERE c.centro_custo IS DISTINCT FROM 'Reforma Sede Jardim América'
        GROUP BY 1, 2
    ),
    producao_mensal AS (
        -- Aggregate production (POC) and calculate budgeted cost per project and month
        SELECT 
            s.projeto_id,
            date_trunc('month', d.data) AS mes_referencia,
            SUM(dp.valor_total) AS poc,
            SUM(CASE 
                WHEN il.bdi > 0 THEN dp.valor_total / il.bdi 
                WHEN mkp.bdi_venda > 0 THEN dp.valor_total / mkp.bdi_venda
                ELSE dp.valor_total 
            END) AS custo_direto_orcado
        FROM diarios_obra d
        JOIN sites s ON d.site_id = s.id
        JOIN diario_producao dp ON d.id = dp.diario_id
        JOIN itens_lpu il ON dp.item_lpu_id = il.id
        LEFT JOIN mkp_parametros mkp ON s.projeto_id = mkp.projeto_id
        GROUP BY 1, 2
    ),
    metricas_base AS (
        SELECT
            p.projeto_id,
            p.projeto_nome,
            p.area_nome,
            p.cliente_nome,
            p.mes_referencia,
            COALESCE(pm.poc, 0) AS poc,
            COALESCE(pm.custo_direto_orcado, 0) AS custo_direto_orcado,
            COALESCE(cm.mo, 0) AS mo,
            COALESCE(cm.mat, 0) AS mat,
            COALESCE(cm.transp, 0) AS transp,
            COALESCE(cm.indir, 0) AS indir,
            COALESCE(cm.custo_direto_real, 0) AS custo_direto_real,
            COALESCE(cm.gerencia_real, 0) AS gerencia_real,
            COALESCE(imp.perc_total_impostos, 0) AS perc_impostos,
            COALESCE(mkp.perc_risco, 0) AS perc_risco,
            COALESCE(mkp.perc_inflacao, 0) AS perc_inflacao,
            COALESCE(mkp.perc_gerencia, 0) AS perc_gerencia,
            COALESCE(mkp.perc_treinamento, 0) AS perc_treinamento
        FROM periodos p
        LEFT JOIN custos_mensais cm ON p.projeto_id = cm.projeto_id AND p.mes_referencia = cm.mes_referencia
        LEFT JOIN producao_mensal pm ON p.projeto_id = pm.projeto_id AND p.mes_referencia = pm.mes_referencia
        LEFT JOIN projeto_impostos imp ON p.projeto_id = imp.projeto_id
        LEFT JOIN mkp_parametros mkp ON p.projeto_id = mkp.projeto_id
    )
    SELECT
        to_char(mes_referencia, 'Mon/YYYY') AS "Referência",
        COALESCE(area_nome, 'N/A') AS "Área",
        projeto_nome AS "Projeto",
        COALESCE(cliente_nome, 'N/A') AS "Cliente",
        poc AS "Produção (POC)",
        perc_impostos AS "% Impostos",
        (poc * (1 - perc_impostos)) AS "Receita Líquida",
        mo AS "MO",
        mat AS "Mat.",
        transp AS "Transp.",
        indir AS "Indir.",
        custo_direto_real AS "Custo Direto Real",
        custo_direto_orcado AS "Custo Direto Orçado",
        (custo_direto_orcado - custo_direto_real) AS "Resultado Direto",
        gerencia_real AS "Gerência Real",
        (custo_direto_orcado * perc_gerencia) AS "Gerência Orçada",
        ((custo_direto_orcado * perc_gerencia) - gerencia_real) AS "Resultado Gerência",
        CASE WHEN custo_direto_real > 0 THEN (gerencia_real / custo_direto_real) ELSE 0 END AS "% Gerência Real",
        perc_gerencia AS "% Gerência Orç.",
        (custo_direto_real + gerencia_real) AS "Custo Total Real",
        -- Formula for Custo Total Orçado from useAnaliseCustos.ts
        (
            custo_direto_orcado +
            custo_direto_orcado * perc_risco +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
            (custo_direto_orcado * perc_gerencia) +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
        ) AS "Custo Total Orçado",
        -- Result calculations
        (
            (
                custo_direto_orcado +
                custo_direto_orcado * perc_risco +
                (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
                (custo_direto_orcado * perc_gerencia) +
                (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
            ) - (custo_direto_real + gerencia_real)
        ) AS "Resultado Total",
        -- MB Calculations
        ((poc * (1 - perc_impostos)) - (
            custo_direto_orcado +
            custo_direto_orcado * perc_risco +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
            (custo_direto_orcado * perc_gerencia) +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
        )) AS "MB Orç. (R$)",
        ((poc * (1 - perc_impostos)) - (custo_direto_real + gerencia_real)) AS "MB Real (R$)",
        CASE 
            WHEN (poc * (1 - perc_impostos)) > 0 THEN 
                ((poc * (1 - perc_impostos)) - (
                    custo_direto_orcado +
                    custo_direto_orcado * perc_risco +
                    (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
                    (custo_direto_orcado * perc_gerencia) +
                    (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
                )) / (poc * (1 - perc_impostos))
            ELSE 0 
        END AS "% MB Orç.",
        CASE 
            WHEN (poc * (1 - perc_impostos)) > 0 THEN 
                ((poc * (1 - perc_impostos)) - (custo_direto_real + gerencia_real)) / (poc * (1 - perc_impostos))
            ELSE 0 
        END AS "% MB Real",
        projeto_id AS "ID Projeto",
        EXTRACT(month FROM mes_referencia)::integer AS "Mês Num",
        EXTRACT(year FROM mes_referencia)::integer AS "Ano"
    FROM metricas_base
    -- Filter out rows with no activity
    WHERE poc > 0 OR custo_direto_real > 0 OR gerencia_real > 0;
END;
$$;

-- Finally recreate the view
CREATE VIEW public.view_bi_analise_obras AS
SELECT * FROM public.get_bi_analise_obras();

-- Grant access to anon and authenticated roles
GRANT SELECT ON public.view_bi_analise_obras TO anon;
GRANT SELECT ON public.view_bi_analise_obras TO authenticated;
