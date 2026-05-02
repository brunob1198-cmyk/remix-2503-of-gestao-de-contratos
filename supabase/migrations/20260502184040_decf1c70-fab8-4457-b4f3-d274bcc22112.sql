CREATE OR REPLACE VIEW public.view_bi_producao AS
 SELECT dp.id,
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
    'diario'::text AS origem
   FROM diario_producao dp
     JOIN diarios_obra d ON d.id = dp.diario_id
     JOIN sites s ON s.id = d.site_id
     JOIN projetos p ON p.id = s.projeto_id
     LEFT JOIN areas a ON a.id = p.area_id
     JOIN itens_lpu il ON il.id = dp.item_lpu_id
UNION ALL
 SELECT lm.id,
    lm.data_medicao AS data_producao,
    lm.site_id,
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
    lm.quantidade,
    il.preco_unitario AS preco_unitario_congelado,
    (lm.quantidade * il.preco_unitario) AS valor_total,
    NULL::text AS clima,
    s.uf,
    s.municipio,
    EXTRACT(year FROM lm.data_medicao)::integer AS ano,
    EXTRACT(month FROM lm.data_medicao)::integer AS mes,
    'manual'::text AS origem
   FROM lancamentos_medicao lm
     JOIN sites s ON s.id = lm.site_id
     JOIN projetos p ON p.id = s.projeto_id
     LEFT JOIN areas a ON a.id = p.area_id
     JOIN itens_lpu il ON il.id = lm.item_lpu_id;

GRANT SELECT ON public.view_bi_producao TO anon, authenticated, service_role;