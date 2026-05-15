CREATE OR REPLACE VIEW public.view_bi_dim_categoria AS
WITH raw_data AS (
    SELECT 
        m.id,
        m.categoria_erp,
        m.categoria_interna,
        m.ativo
    FROM mapeamento_categorias_erp m
    UNION
    SELECT 
        gen_random_uuid() AS id,
        c.categoria_erp,
        c.categoria_interna,
        true AS ativo
    FROM custo_real_erp c
    WHERE NOT (EXISTS ( SELECT 1
           FROM mapeamento_categorias_erp m
          WHERE m.categoria_erp = c.categoria_erp))
),
ranked_data AS (
    SELECT 
        id,
        categoria_erp,
        categoria_interna,
        ativo,
        ROW_NUMBER() OVER (PARTITION BY LOWER(categoria_erp) ORDER BY id) as rn
    FROM raw_data
)
SELECT 
    id,
    categoria_erp,
    categoria_interna,
    ativo
FROM ranked_data
WHERE rn = 1;