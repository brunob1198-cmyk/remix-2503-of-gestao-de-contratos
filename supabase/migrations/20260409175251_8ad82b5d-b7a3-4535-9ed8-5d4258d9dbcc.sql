DROP VIEW IF EXISTS public.view_producao_diario;
CREATE VIEW public.view_producao_diario AS
SELECT dp.id,
    d.site_id,
    s.codigo AS site_codigo,
    s.nome AS site_nome,
    p.id AS projeto_id,
    p.codigo AS projeto_codigo,
    p.nome AS projeto_nome,
    p.empresa_id,
    il.id AS item_lpu_id,
    il.codigo AS item_codigo,
    il.descricao AS item_descricao,
    il.unidade AS item_unidade,
    il.preco_unitario::numeric AS preco_unitario,
    dp.quantidade,
    (il.preco_unitario * dp.quantidade)::numeric AS valor_produzido,
    d.data AS data_producao,
    EXTRACT(year FROM d.data)::integer AS ano,
    EXTRACT(month FROM d.data)::integer AS mes
   FROM diario_producao dp
     JOIN diarios_obra d ON d.id = dp.diario_id
     JOIN sites s ON s.id = d.site_id
     JOIN projetos p ON p.id = s.projeto_id
     JOIN itens_lpu il ON il.id = dp.item_lpu_id;