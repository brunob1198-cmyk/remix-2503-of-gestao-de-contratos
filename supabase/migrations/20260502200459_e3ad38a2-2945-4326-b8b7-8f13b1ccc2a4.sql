-- Redefinir a view_bi_producao para focar apenas em RDO
CREATE OR REPLACE VIEW public.view_bi_producao AS
WITH consolidated_production AS (
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
        'diario'::text AS origem
    FROM diario_producao dp
    JOIN diarios_obra d ON d.id = dp.diario_id
    JOIN sites s ON s.id = d.site_id
    JOIN projetos p ON p.id = s.projeto_id
    LEFT JOIN areas a ON a.id = p.area_id
    JOIN itens_lpu il ON il.id = dp.item_lpu_id
)
SELECT 
    id,
    data_producao,
    site_id,
    site_codigo,
    site_nome,
    projeto_id,
    projeto_codigo,
    projeto_nome,
    area_id,
    area_nome,
    item_lpu_id,
    item_codigo,
    item_descricao,
    unidade,
    quantidade,
    preco_unitario_congelado,
    valor_total,
    clima,
    uf,
    municipio,
    origem,
    EXTRACT(year FROM data_producao)::integer AS ano,
    EXTRACT(month FROM data_producao)::integer AS mes
FROM consolidated_production;