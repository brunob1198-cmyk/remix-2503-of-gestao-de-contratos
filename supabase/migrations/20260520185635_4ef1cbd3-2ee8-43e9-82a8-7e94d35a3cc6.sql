-- Drop a view existente
DROP VIEW IF EXISTS public.view_bi_analise_obras;

-- Recria a view com SECURITY DEFINER
-- Isso permite que a view ignore as políticas de RLS das tabelas base (custo_real_erp, projetos, contratos)
-- quando acessada via API Web (Power BI), pois ela rodará com as permissões do criador (owner).
CREATE OR REPLACE FUNCTION public.get_bi_analise_obras()
RETURNS TABLE (
    "Projeto" TEXT,
    "Contrato" TEXT,
    "Fornecedor" TEXT,
    "Categoria" TEXT,
    "Mês" TEXT,
    "Ano" INTEGER,
    "Valor" NUMERIC,
    "ID Projeto" UUID,
    "ID Contrato" UUID,
    "Mês Num" INTEGER
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
   SELECT p.nome AS "Projeto",
    con.numero_contrato AS "Contrato",
    NULL::text AS "Fornecedor",
    c.categoria_interna AS "Categoria",
        CASE EXTRACT(month FROM c.data_competencia)
            WHEN 1 THEN 'Jan'::text
            WHEN 2 THEN 'Fev'::text
            WHEN 3 THEN 'Mar'::text
            WHEN 4 THEN 'Abr'::text
            WHEN 5 THEN 'Mai'::text
            WHEN 6 THEN 'Jun'::text
            WHEN 7 THEN 'Jul'::text
            WHEN 8 THEN 'Ago'::text
            WHEN 9 THEN 'Set'::text
            WHEN 10 THEN 'Out'::text
            WHEN 11 THEN 'Nov'::text
            WHEN 12 THEN 'Dez'::text
            ELSE NULL::text
        END AS "Mês",
    (EXTRACT(year FROM c.data_competencia))::integer AS "Ano",
    c.valor AS "Valor",
    c.projeto_id AS "ID Projeto",
    p.contrato_id AS "ID Contrato",
    (EXTRACT(month FROM c.data_competencia))::integer AS "Mês Num"
   FROM ((custo_real_erp c
     JOIN projetos p ON ((p.id = c.projeto_id)))
     LEFT JOIN contratos con ON ((con.id = p.contrato_id)))
  WHERE (c.data_competencia IS NOT NULL);
$$;

-- Criar a view baseada na função SECURITY DEFINER
CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
SELECT * FROM public.get_bi_analise_obras();

-- Garantir acesso para anon e authenticated
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated;
