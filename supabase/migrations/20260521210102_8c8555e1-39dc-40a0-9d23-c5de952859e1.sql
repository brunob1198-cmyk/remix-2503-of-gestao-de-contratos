CREATE OR REPLACE FUNCTION public.get_bi_analise_obras()
 RETURNS TABLE("Referência" text, "Área" text, "Projeto" text, "Cliente" text, "Produção (POC)" double precision, "% Impostos" double precision, "Receita Líquida" double precision, "MO" double precision, "Mat." double precision, "Transp." double precision, "Indir." double precision, "Custo Direto Real" double precision, "Custo Direto Orçado" double precision, "Resultado Direto" double precision, "Gerência Real" double precision, "Gerência Orçada" double precision, "Resultado Gerência" double precision, "% Gerência Real" double precision, "% Gerência Orç." double precision, "Custo Total Real" double precision, "Custo Total Orçado" double precision, "Resultado Total" double precision, "MB Orç. (R$)" double precision, "MB Real (R$)" double precision, "% MB Orç." double precision, "% MB Real" double precision, "ID Projeto" uuid, "Mês Num" integer, "Ano" integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    WITH periodos AS (
        -- Garantir que todos os meses com produção OU custo sejam considerados
        SELECT DISTINCT
            p.id AS projeto_id,
            p.nome AS projeto_nome,
            a.nome AS area_nome,
            cl.razao_social AS cliente_nome,
            meses.mes_ref AS mes_referencia
        FROM projetos p
        LEFT JOIN areas a ON p.area_id = a.id
        LEFT JOIN clientes cl ON p.cliente_id = cl.id
        CROSS JOIN LATERAL (
            SELECT date_trunc('month', d.data) as mes_ref 
            FROM sites s 
            JOIN diarios_obra d ON s.id = d.site_id 
            WHERE s.projeto_id = p.id
            UNION
            SELECT date_trunc('month', c.data_competencia) as mes_ref 
            FROM custo_real_erp c 
            WHERE c.projeto_id = p.id
        ) meses
        WHERE meses.mes_ref IS NOT NULL
    ),
    custos_mensais AS (
        SELECT 
            c.projeto_id,
            date_trunc('month', c.data_competencia) AS mes_referencia,
            SUM(CASE WHEN c.categoria_interna = 'Mão de Obra' THEN c.valor ELSE 0 END) AS mo,
            SUM(CASE WHEN c.categoria_interna = 'Materiais' THEN c.valor ELSE 0 END) AS mat,
            SUM(CASE WHEN c.categoria_interna = 'Transporte' THEN c.valor ELSE 0 END) AS transp,
            SUM(CASE WHEN c.categoria_interna = 'Indiretos' THEN c.valor ELSE 0 END) AS indir,
            -- Custo Direto Real deve incluir Equipamentos para bater com a tela de análise
            SUM(CASE WHEN c.categoria_interna NOT IN ('Gerência', 'Financeiros') THEN c.valor ELSE 0 END) AS custo_direto_real,
            SUM(CASE WHEN c.categoria_interna = 'Gerência' THEN c.valor ELSE 0 END) AS gerencia_real
        FROM custo_real_erp c
        -- Excluir categorias desativadas (mesma lógica do hook useAnaliseCustos)
        WHERE c.centro_custo IS DISTINCT FROM 'Reforma Sede Jardim América'
        AND c.categoria_erp NOT IN (
            SELECT categoria_erp FROM mapeamento_categorias_erp WHERE ativo = false
        )
        GROUP BY 1, 2
    ),
    producao_mensal AS (
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
        to_char(mes_referencia, 'Mon/YYYY')::text AS "Referência",
        COALESCE(area_nome, 'N/A')::text AS "Área",
        projeto_nome::text AS "Projeto",
        COALESCE(cliente_nome, 'N/A')::text AS "Cliente",
        poc::float8 AS "Produção (POC)",
        perc_impostos::float8 AS "% Impostos",
        (poc * (1 - perc_impostos))::float8 AS "Receita Líquida",
        mo::float8 AS "MO",
        mat::float8 AS "Mat.",
        transp::float8 AS "Transp.",
        indir::float8 AS "Indir.",
        custo_direto_real::float8 AS "Custo Direto Real",
        custo_direto_orcado::float8 AS "Custo Direto Orçado",
        (custo_direto_orcado - custo_direto_real)::float8 AS "Resultado Direto",
        gerencia_real::float8 AS "Gerência Real",
        (custo_direto_orcado * perc_gerencia)::float8 AS "Gerência Orçada",
        ((custo_direto_orcado * perc_gerencia) - gerencia_real)::float8 AS "Resultado Gerência",
        (CASE WHEN custo_direto_real > 0 THEN (gerencia_real / custo_direto_real) ELSE 0 END)::float8 AS "% Gerência Real",
        perc_gerencia::float8 AS "% Gerência Orç.",
        (custo_direto_real + gerencia_real)::float8 AS "Custo Total Real",
        (
            custo_direto_orcado +
            custo_direto_orcado * perc_risco +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
            (custo_direto_orcado * perc_gerencia) +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
        )::float8 AS "Custo Total Orçado",
        (
            (
                custo_direto_orcado +
                custo_direto_orcado * perc_risco +
                (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
                (custo_direto_orcado * perc_gerencia) +
                (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
            ) - (custo_direto_real + gerencia_real)
        )::float8 AS "Resultado Total",
        ((poc * (1 - perc_impostos)) - (
            custo_direto_orcado +
            custo_direto_orcado * perc_risco +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
            (custo_direto_orcado * perc_gerencia) +
            (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
        ))::float8 AS "MB Orç. (R$)",
        ((poc * (1 - perc_impostos)) - (custo_direto_real + gerencia_real))::float8 AS "MB Real (R$)",
        (CASE 
            WHEN (poc * (1 - perc_impostos)) > 0 THEN 
                ((poc * (1 - perc_impostos)) - (
                    custo_direto_orcado +
                    custo_direto_orcado * perc_risco +
                    (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_inflacao +
                    (custo_direto_orcado * perc_gerencia) +
                    (custo_direto_orcado + custo_direto_orcado * (perc_risco + perc_gerencia)) * perc_treinamento
                )) / (poc * (1 - perc_impostos))
            ELSE 0 
        END)::float8 AS "% MB Orç.",
        (CASE 
            WHEN (poc * (1 - perc_impostos)) > 0 THEN 
                ((poc * (1 - perc_impostos)) - (custo_direto_real + gerencia_real)) / (poc * (1 - perc_impostos))
            ELSE 0 
        END)::float8 AS "% MB Real",
        projeto_id AS "ID Projeto",
        EXTRACT(month FROM mes_referencia)::int4 AS "Mês Num",
        EXTRACT(year FROM mes_referencia)::int4 AS "Ano"
    FROM metricas_base
    WHERE poc > 0 OR custo_direto_real > 0 OR gerencia_real > 0;
END;
$function$
;