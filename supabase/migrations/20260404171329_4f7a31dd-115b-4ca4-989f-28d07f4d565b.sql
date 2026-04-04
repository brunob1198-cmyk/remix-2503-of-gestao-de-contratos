CREATE OR REPLACE VIEW public.view_producao_diario AS
SELECT
  dp.id,
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
  dp.preco_unitario_congelado AS preco_unitario,
  dp.quantidade,
  dp.valor_total AS valor_produzido,
  d.data AS data_producao,
  EXTRACT(YEAR FROM d.data)::int AS ano,
  EXTRACT(MONTH FROM d.data)::int AS mes
FROM diario_producao dp
JOIN diarios_obra d ON d.id = dp.diario_id
JOIN sites s ON s.id = d.site_id
JOIN projetos p ON p.id = s.projeto_id
JOIN itens_lpu il ON il.id = dp.item_lpu_id;