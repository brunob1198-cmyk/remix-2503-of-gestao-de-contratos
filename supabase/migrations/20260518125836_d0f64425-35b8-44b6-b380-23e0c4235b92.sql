DROP VIEW IF EXISTS public.view_bi_analise_obras;

CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
WITH meses AS (
  SELECT DISTINCT first_of_month(x.d) AS mes
  FROM (
    SELECT data_competencia AS d FROM custo_real_erp
    UNION ALL SELECT data_producao AS d FROM view_bi_producao
    UNION ALL SELECT data_emissao AS d FROM faturamentos
  ) x WHERE x.d IS NOT NULL
),
projetos_base AS (
  SELECT p.id AS projeto_id, p.codigo AS projeto_codigo, p.nome AS projeto_nome,
    p.status AS projeto_status, p.valor_total AS projeto_valor_total,
    p.empresa_id, e.nome AS empresa_nome,
    p.area_id, a.nome AS area_nome,
    p.cliente_id, c.razao_social AS cliente_razao_social, c.cnpj AS cliente_cnpj
  FROM projetos p
  LEFT JOIN empresas e ON e.id = p.empresa_id
  LEFT JOIN areas a ON a.id = p.area_id
  LEFT JOIN clientes c ON c.id = p.cliente_id
),
producao_fatos AS (
  SELECT 
    s.projeto_id, 
    first_of_month(d_o.data) AS mes,
    'PRODUÇÃO'::text AS categoria_interna,
    'PRODUÇÃO'::text AS categoria_erp,
    'PRODUCAO'::text AS tipo_registro,
    SUM(dp.valor_total) AS poc,
    SUM(CASE WHEN lpu.bdi > 0 THEN dp.valor_total / lpu.bdi ELSE dp.valor_total END) AS custo_direto_orcado_producao,
    0::numeric AS custo_total_real,
    0::numeric AS faturamento_bruto,
    0::numeric AS faturamento_liquido,
    0 AS qtd_faturas
  FROM diario_producao dp
  JOIN diarios_obra d_o ON d_o.id = dp.diario_id
  JOIN sites s ON s.id = d_o.site_id
  LEFT JOIN itens_lpu lpu ON lpu.id = dp.item_lpu_id
  GROUP BY s.projeto_id, first_of_month(d_o.data)
),
custos_fatos AS (
  SELECT 
    projeto_id, 
    first_of_month(data_competencia) AS mes,
    categoria_interna,
    categoria_erp,
    'CUSTO'::text AS tipo_registro,
    0::numeric AS poc,
    0::numeric AS custo_direto_orcado_producao,
    SUM(valor) AS custo_total_real,
    0::numeric AS faturamento_bruto,
    0::numeric AS faturamento_liquido,
    0 AS qtd_faturas
  FROM custo_real_erp
  GROUP BY projeto_id, first_of_month(data_competencia), categoria_interna, categoria_erp
),
faturas_fatos AS (
  SELECT 
    projeto_id, 
    first_of_month(data_emissao) AS mes,
    'FATURAMENTO'::text AS categoria_interna,
    'FATURAMENTO'::text AS categoria_erp,
    'FATURAMENTO'::text AS tipo_registro,
    0::numeric AS poc,
    0::numeric AS custo_direto_orcado_producao,
    0::numeric AS custo_total_real,
    SUM(valor_bruto)   AS faturamento_bruto,
    SUM(valor_liquido) AS faturamento_liquido,
    COUNT(*)           AS qtd_faturas
  FROM faturamentos
  GROUP BY projeto_id, first_of_month(data_emissao)
),
all_fatos AS (
  SELECT * FROM producao_fatos
  UNION ALL
  SELECT * FROM custos_fatos
  UNION ALL
  SELECT * FROM faturas_fatos
),
mkp_base AS (
  SELECT projeto_id,
    COALESCE(perc_risco,0) AS perc_risco,
    COALESCE(perc_inflacao,0) AS perc_inflacao,
    COALESCE(perc_gerencia,0) AS perc_gerencia,
    COALESCE(perc_mb_esperado,0) AS perc_mb_mkp,
    COALESCE(perc_treinamento,0) AS perc_treinamento
  FROM mkp_parametros
),
impostos_base AS (
  SELECT projeto_id, COALESCE(perc_total_impostos,0) AS perc_total_impostos
  FROM projeto_impostos
),
base AS (
  SELECT
    af.projeto_id, af.mes, af.categoria_interna, af.categoria_erp, af.tipo_registro,
    pb.projeto_codigo, pb.projeto_nome, pb.projeto_status,
    pb.area_id, pb.area_nome,
    pb.cliente_id, pb.cliente_razao_social, pb.cliente_cnpj,
    pb.empresa_id, pb.empresa_nome,
    af.poc,
    COALESCE(imp.perc_total_impostos,0) AS perc_impostos,
    af.poc * (1 - COALESCE(imp.perc_total_impostos,0)) AS receita_liquida,
    af.custo_total_real,
    af.custo_direto_orcado_producao AS custo_direto_orcado,
    af.faturamento_bruto,
    af.faturamento_liquido,
    af.qtd_faturas,
    -- Summary columns for backward compatibility (only populated on relevant rows)
    CASE WHEN af.categoria_interna = 'Mão de Obra' THEN af.custo_total_real ELSE 0 END AS mo_obra,
    CASE WHEN af.categoria_interna = 'Materiais'   THEN af.custo_total_real ELSE 0 END AS materiais,
    CASE WHEN af.categoria_interna = 'Transporte'  THEN af.custo_total_real ELSE 0 END AS transporte,
    CASE WHEN af.categoria_interna = 'Indiretos'   THEN af.custo_total_real ELSE 0 END AS indiretos,
    CASE WHEN af.categoria_interna = 'Equipamentos' THEN af.custo_total_real ELSE 0 END AS equipamentos,
    CASE WHEN af.categoria_interna = 'Financeiros' THEN af.custo_total_real ELSE 0 END AS financeiros,
    CASE WHEN af.categoria_interna = 'Gerência'    THEN af.custo_total_real ELSE 0 END AS gerencia_real,
    -- Budget / MKP metrics
    af.custo_direto_orcado_producao * COALESCE(mkp.perc_gerencia,0) AS gerencia_orcada,
    af.custo_direto_orcado_producao
      * (1 + COALESCE(mkp.perc_risco,0) + COALESCE(mkp.perc_gerencia,0) + COALESCE(mkp.perc_treinamento,0))
      * (1 + COALESCE(mkp.perc_inflacao,0)) AS custo_total_orcado,
    COALESCE(mkp.perc_mb_mkp,0) AS perc_mb_mkp
  FROM all_fatos af
  JOIN projetos_base pb ON pb.projeto_id = af.projeto_id
  LEFT JOIN mkp_base mkp ON mkp.projeto_id = af.projeto_id
  LEFT JOIN impostos_base imp ON imp.projeto_id = af.projeto_id
)
SELECT
  projeto_id, mes,
  EXTRACT(YEAR FROM mes)::int  AS ano,
  EXTRACT(MONTH FROM mes)::int AS mes_numero,
  to_char(mes, 'YYYY-MM')      AS ano_mes,
  to_char(mes, 'MM/YYYY')      AS referencia,
  projeto_codigo, projeto_nome, projeto_status,
  area_id, area_nome,
  cliente_id, cliente_razao_social AS cliente, cliente_cnpj,
  empresa_id, empresa_nome,
  categoria_interna, categoria_erp, tipo_registro,
  poc,
  perc_impostos,
  receita_liquida,
  custo_total_real,
  custo_total_real AS custo_erp_total,
  mo_obra,
  materiais,
  transporte,
  indiretos,
  equipamentos,
  financeiros,
  gerencia_real,
  custo_direto_orcado,
  gerencia_orcada,
  custo_total_orcado,
  perc_mb_mkp,
  faturamento_bruto,
  faturamento_liquido,
  qtd_faturas,
  -- Result metrics (mostly valid for summary, but provided here)
  receita_liquida - custo_total_real AS mb_real,
  receita_liquida - custo_total_orcado AS mb_orcada,
  CASE WHEN receita_liquida > 0 THEN (receita_liquida - custo_total_real) / receita_liquida ELSE 0 END AS perc_mb_real
FROM base;