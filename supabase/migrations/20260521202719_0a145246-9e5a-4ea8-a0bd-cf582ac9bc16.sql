-- Dropar a view atual para permitir mudança de tipos de coluna
DROP VIEW IF EXISTS public.view_quadro_geral_bi;

-- Função para retornar os dados do quadro geral
CREATE OR REPLACE FUNCTION public.get_quadro_geral_bi()
RETURNS TABLE (
    "Área" text,
    "Cliente" text,
    "Projeto Código" text,
    "Projeto Nome" text,
    "Status Projeto" text,
    "Site Código" text,
    "Site Nome" text,
    "Valor Contrato" float8,
    "Valor Executado" float8,
    "Valor Faturado" float8,
    "Valor Não Faturado" float8,
    "Saldo Contrato" float8,
    "% Evolução" float8
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH contratos_resumo AS (
        SELECT 
            c.id as contrato_id,
            COALESCE(c.valor_total, 0) + COALESCE((SELECT SUM(a.valor_total) FROM contratos a WHERE a.contrato_pai_id = c.id), 0) as valor_consolidado
        FROM contratos c
        WHERE c.contrato_pai_id IS NULL
    ),
    projeto_contratos AS (
        SELECT 
            p.id as projeto_id,
            SUM(cr.valor_consolidado) as valor_contratos_vinculados
        FROM projetos p
        CROSS JOIN LATERAL unnest(COALESCE(p.contrato_ids, ARRAY[]::uuid[])) as cid
        JOIN contratos_resumo cr ON cr.contrato_id = cid
        GROUP BY p.id
    ),
    executado_diarios AS (
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
        SELECT 
            lp.site_id,
            SUM(lp.quantidade * COALESCE(il.preco_unitario, 0)) as valor_executado
        FROM lancamentos_producao lp
        JOIN itens_lpu il ON il.id = lp.item_lpu_id
        GROUP BY 1
    ),
    faturado_resumo AS (
        SELECT 
            lf.site_id,
            SUM(COALESCE(lf.valor_faturado, lf.quantidade * COALESCE(il.preco_unitario, 0))) as valor_faturado
        FROM lancamentos_faturamento lf
        JOIN itens_lpu il ON il.id = lf.item_lpu_id
        GROUP BY 1
    ),
    site_metrics AS (
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
        COALESCE(a.nome, 'N/A')::text as "Área",
        COALESCE(p.cliente, 'N/A')::text as "Cliente",
        p.codigo::text as "Projeto Código",
        p.nome::text as "Projeto Nome",
        COALESCE(p.status, 'N/A')::text as "Status Projeto",
        sm.site_codigo::text as "Site Código",
        sm.site_nome::text as "Site Nome",
        COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0)::float8 as "Valor Contrato",
        sm.valor_executado_site::float8 as "Valor Executado",
        sm.valor_faturado_site::float8 as "Valor Faturado",
        (sm.valor_executado_site - sm.valor_faturado_site)::float8 as "Valor Não Faturado",
        GREATEST(0, COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0) - sm.valor_executado_site)::float8 as "Saldo Contrato",
        CASE 
            WHEN COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0) > 0 
            THEN (sm.valor_executado_site / COALESCE(pc.valor_contratos_vinculados, p.valor_total, 0)) * 100 
            ELSE 0 
        END::float8 as "% Evolução"
    FROM projetos p
    LEFT JOIN areas a ON a.id = p.area_id
    LEFT JOIN projeto_contratos pc ON pc.projeto_id = p.id
    LEFT JOIN site_metrics sm ON sm.projeto_id = p.id;
END;
$$;

-- Criar a view baseada na função
CREATE VIEW public.view_quadro_geral_bi AS
SELECT * FROM public.get_quadro_geral_bi();

-- Garantir acesso
GRANT EXECUTE ON FUNCTION public.get_quadro_geral_bi() TO anon, authenticated;
GRANT SELECT ON public.view_quadro_geral_bi TO anon, authenticated;