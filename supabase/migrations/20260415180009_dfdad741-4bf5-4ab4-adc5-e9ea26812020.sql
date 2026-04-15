
-- View Financeiro: custos do ERP consolidados
CREATE OR REPLACE VIEW public.view_bi_financeiro AS
SELECT
  c.id,
  c.projeto_id,
  p.codigo AS projeto_codigo,
  p.nome AS projeto_nome,
  c.descricao,
  c.valor,
  c.categoria_erp,
  c.categoria_interna,
  c.centro_custo,
  c.data_competencia,
  c.data_pagamento,
  c.status_erp,
  c.site_id,
  s.codigo AS site_codigo,
  s.nome AS site_nome,
  EXTRACT(YEAR FROM c.data_competencia)::int AS ano,
  EXTRACT(MONTH FROM c.data_competencia)::int AS mes,
  CASE EXTRACT(QUARTER FROM c.data_competencia)::int
    WHEN 1 THEN 'Q1' WHEN 2 THEN 'Q2' WHEN 3 THEN 'Q3' WHEN 4 THEN 'Q4'
  END AS trimestre
FROM public.custo_real_erp c
LEFT JOIN public.projetos p ON p.id = c.projeto_id
LEFT JOIN public.sites s ON s.id = c.site_id;

-- View Produção: produção diária consolidada
CREATE OR REPLACE VIEW public.view_bi_producao AS
SELECT
  dp.id,
  do2.data AS data_producao,
  do2.site_id,
  s.codigo AS site_codigo,
  s.nome AS site_nome,
  p.id AS projeto_id,
  p.codigo AS projeto_codigo,
  p.nome AS projeto_nome,
  il.id AS item_lpu_id,
  il.codigo AS item_codigo,
  il.descricao AS item_descricao,
  il.unidade,
  dp.quantidade,
  dp.preco_unitario_congelado,
  dp.valor_total,
  do2.clima,
  do2.uf,
  do2.municipio,
  EXTRACT(YEAR FROM do2.data)::int AS ano,
  EXTRACT(MONTH FROM do2.data)::int AS mes
FROM public.diario_producao dp
JOIN public.diarios_obra do2 ON do2.id = dp.diario_id
JOIN public.sites s ON s.id = do2.site_id
JOIN public.projetos p ON p.id = s.projeto_id
JOIN public.itens_lpu il ON il.id = dp.item_lpu_id;

-- View Contratos: contratos com métricas
CREATE OR REPLACE VIEW public.view_bi_contratos AS
SELECT
  c.id,
  c.numero_contrato,
  c.valor_total,
  c.prazo_inicio,
  c.prazo_fim,
  c.escopo,
  c.condicoes_pagamento,
  c.empresa_id,
  c.contrato_pai_id,
  c.status_processamento,
  CASE
    WHEN c.prazo_fim IS NULL THEN 'indefinido'
    WHEN c.prazo_fim < CURRENT_DATE THEN 'vencido'
    WHEN c.prazo_fim < CURRENT_DATE + INTERVAL '30 days' THEN 'vencendo'
    ELSE 'vigente'
  END AS status_prazo,
  (SELECT COUNT(*) FROM public.projetos p WHERE p.contrato_id = c.id) AS total_projetos,
  (SELECT COALESCE(SUM(cr.valor), 0) FROM public.custo_real_erp cr
   JOIN public.projetos p2 ON p2.id = cr.projeto_id
   WHERE p2.contrato_id = c.id) AS total_custos_realizados
FROM public.contratos c;

-- Dimensão Tempo
CREATE OR REPLACE VIEW public.view_bi_dim_tempo AS
SELECT DISTINCT
  d::date AS data,
  EXTRACT(YEAR FROM d)::int AS ano,
  EXTRACT(MONTH FROM d)::int AS mes,
  EXTRACT(QUARTER FROM d)::int AS trimestre,
  TO_CHAR(d, 'TMMonth') AS nome_mes,
  TO_CHAR(d, 'YYYY-MM') AS ano_mes,
  EXTRACT(DOW FROM d)::int AS dia_semana,
  EXTRACT(DAY FROM d)::int AS dia
FROM generate_series('2024-01-01'::date, '2030-12-31'::date, '1 day'::interval) d;

-- Dimensão Categoria
CREATE OR REPLACE VIEW public.view_bi_dim_categoria AS
SELECT DISTINCT
  m.id,
  m.categoria_erp,
  m.categoria_interna,
  m.ativo
FROM public.mapeamento_categorias_erp m
UNION
SELECT DISTINCT
  gen_random_uuid() AS id,
  c.categoria_erp,
  c.categoria_interna,
  true AS ativo
FROM public.custo_real_erp c
WHERE NOT EXISTS (
  SELECT 1 FROM public.mapeamento_categorias_erp m
  WHERE m.categoria_erp = c.categoria_erp
);
