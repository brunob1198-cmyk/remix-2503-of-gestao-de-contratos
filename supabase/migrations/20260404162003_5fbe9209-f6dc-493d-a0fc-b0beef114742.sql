
-- View Financeiro
CREATE OR REPLACE VIEW public.view_financeiro AS
SELECT
  c.id,
  c.projeto_id,
  p.codigo AS projeto_codigo,
  p.nome AS projeto_nome,
  p.empresa_id,
  c.categoria_interna AS categoria,
  c.categoria_erp,
  c.descricao,
  c.valor,
  c.status_erp AS status,
  c.data_competencia,
  c.data_pagamento,
  c.centro_custo,
  c.site_id,
  s.codigo AS site_codigo,
  s.nome AS site_nome,
  EXTRACT(YEAR FROM c.data_competencia) AS ano,
  EXTRACT(MONTH FROM c.data_competencia) AS mes
FROM custo_real_erp c
LEFT JOIN projetos p ON p.id = c.projeto_id
LEFT JOIN sites s ON s.id = c.site_id;

-- View Produção
CREATE OR REPLACE VIEW public.view_producao AS
SELECT
  lp.id,
  lp.site_id,
  s.codigo AS site_codigo,
  s.nome AS site_nome,
  s.projeto_id,
  p.codigo AS projeto_codigo,
  p.nome AS projeto_nome,
  p.empresa_id,
  lp.item_lpu_id,
  il.codigo AS item_codigo,
  il.descricao AS item_descricao,
  il.unidade AS item_unidade,
  il.preco_unitario,
  lp.quantidade,
  (lp.quantidade * il.preco_unitario) AS valor_produzido,
  lp.data_producao,
  lp.empresa_executora,
  lp.uf,
  lp.municipio,
  EXTRACT(YEAR FROM lp.data_producao) AS ano,
  EXTRACT(MONTH FROM lp.data_producao) AS mes
FROM lancamentos_producao lp
JOIN sites s ON s.id = lp.site_id
JOIN projetos p ON p.id = s.projeto_id
JOIN itens_lpu il ON il.id = lp.item_lpu_id;

-- View Contratos
CREATE OR REPLACE VIEW public.view_contratos AS
SELECT
  c.id,
  c.numero_contrato,
  c.empresa_id,
  c.valor_total,
  c.prazo_inicio,
  c.prazo_fim,
  c.status_processamento AS status,
  c.escopo,
  c.created_at,
  (SELECT COUNT(*) FROM projetos pr WHERE pr.contrato_id = c.id) AS total_projetos,
  (SELECT COALESCE(SUM(pr.valor_total), 0) FROM projetos pr WHERE pr.contrato_id = c.id) AS valor_projetos,
  CASE
    WHEN c.prazo_fim IS NULL THEN NULL
    WHEN c.prazo_fim < CURRENT_DATE THEN 100
    WHEN c.prazo_inicio IS NULL THEN 0
    WHEN c.prazo_inicio >= CURRENT_DATE THEN 0
    ELSE ROUND(
      EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - c.prazo_inicio::timestamp)) /
      NULLIF(EXTRACT(EPOCH FROM (c.prazo_fim::timestamp - c.prazo_inicio::timestamp)), 0) * 100
    )
  END AS percentual_prazo
FROM contratos c;
