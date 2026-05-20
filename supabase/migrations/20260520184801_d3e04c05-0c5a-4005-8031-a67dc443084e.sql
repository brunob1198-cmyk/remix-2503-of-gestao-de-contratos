-- Drop existing view
DROP VIEW IF EXISTS public.view_bi_analise_obras;

-- Recreate view with granular cost data formatted for Power BI
CREATE VIEW public.view_bi_analise_obras AS
SELECT 
    p.nome AS "Projeto",
    con.numero_contrato AS "Contrato",
    NULL::TEXT AS "Fornecedor",
    c.categoria_interna AS "Categoria",
    CASE EXTRACT(MONTH FROM c.data_competencia)
        WHEN 1 THEN 'Jan' WHEN 2 THEN 'Fev' WHEN 3 THEN 'Mar'
        WHEN 4 THEN 'Abr' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Jun'
        WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago' WHEN 9 THEN 'Set'
        WHEN 10 THEN 'Out' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dez'
    END AS "Mês",
    EXTRACT(YEAR FROM c.data_competencia)::INTEGER AS "Ano",
    c.valor AS "Valor",
    c.projeto_id AS "ID Projeto",
    p.contrato_id AS "ID Contrato",
    EXTRACT(MONTH FROM c.data_competencia)::INTEGER AS "Mês Num"
FROM public.custo_real_erp c
JOIN public.projetos p ON p.id = c.projeto_id
LEFT JOIN public.contratos con ON con.id = p.contrato_id
WHERE c.data_competencia IS NOT NULL;

-- Grant permissions
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated, service_role;