
-- View consolidada mensal por projeto com dados da tela "Análise de Obras"
CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
WITH meses AS (
  SELECT DISTINCT date_trunc('month', d)::date AS mes
  FROM (
    SELECT data_competencia::date AS d FROM public.custo_real_erp WHERE data_competencia IS NOT NULL
    UNION ALL
    SELECT data::date FROM public.diarios_obra
    UNION ALL
    SELECT data_emissao::date FROM public.faturamentos
    UNION ALL
    SELECT data_medicao::date FROM public.lancamentos_medicao
  ) x
  WHERE d IS NOT NULL
),
projetos_base AS (
  SELECT
    p.id              AS projeto_id,
    p.codigo          AS projeto_codigo,
    p.nome            AS projeto_nome,
    p.status          AS projeto_status,
    p.valor_total     AS projeto_valor_total,
    p.empresa_id,
    e.nome            AS empresa_nome,
    p.area_id,
    a.nome            AS area_nome,
    p.cliente_id,
    c.razao_social    AS cliente_razao_social,
    c.cnpj            AS cliente_cnpj
  FROM public.projetos p
  LEFT JOIN public.empresas  e ON e.id = p.empresa_id
  LEFT JOIN public.areas     a ON a.id = p.area_id
  LEFT JOIN public.clientes  c ON c.id = p.cliente_id
),
matriz AS (
  SELECT pb.*, m.mes
  FROM projetos_base pb
  CROSS JOIN meses m
),
-- Custos ERP por mês/projeto (competência), excluindo categorias desativadas
erp_mes AS (
  SELECT
    cre.projeto_id,
    date_trunc('month', cre.data_competencia)::date AS mes,
    SUM(cre.valor) AS custo_erp_total,
    SUM(CASE WHEN cre.categoria_interna = 'mao_de_obra'   THEN cre.valor ELSE 0 END) AS custo_mao_de_obra,
    SUM(CASE WHEN cre.categoria_interna = 'materiais'     THEN cre.valor ELSE 0 END) AS custo_materiais,
    SUM(CASE WHEN cre.categoria_interna = 'equipamentos'  THEN cre.valor ELSE 0 END) AS custo_equipamentos,
    SUM(CASE WHEN cre.categoria_interna = 'transporte'    THEN cre.valor ELSE 0 END) AS custo_transporte,
    SUM(CASE WHEN cre.categoria_interna = 'indiretos'     THEN cre.valor ELSE 0 END) AS custo_indiretos,
    SUM(CASE WHEN cre.categoria_interna = 'financeiros'   THEN cre.valor ELSE 0 END) AS custo_financeiros,
    SUM(CASE WHEN cre.categoria_interna NOT IN ('mao_de_obra','materiais','equipamentos','transporte','indiretos','financeiros') THEN cre.valor ELSE 0 END) AS custo_outros
  FROM public.custo_real_erp cre
  LEFT JOIN public.mapeamento_categorias_erp mce
    ON mce.categoria_erp = cre.categoria_erp
  WHERE cre.projeto_id IS NOT NULL
    AND cre.data_competencia IS NOT NULL
    AND COALESCE(mce.ativo, true) = true
  GROUP BY cre.projeto_id, date_trunc('month', cre.data_competencia)::date
),
-- Produção mensal (valor) a partir do diário de obra
producao_mes AS (
  SELECT
    s.projeto_id,
    date_trunc('month', d.data)::date AS mes,
    SUM(dp.valor_total)  AS valor_produzido,
    SUM(dp.quantidade)   AS quantidade_produzida,
    COUNT(DISTINCT d.id) AS dias_com_diario
  FROM public.diario_producao dp
  JOIN public.diarios_obra d ON d.id = dp.diario_id
  JOIN public.sites s        ON s.id = d.site_id
  GROUP BY s.projeto_id, date_trunc('month', d.data)::date
),
-- Custos do diário (mão de obra, equipamentos, veículos) por mês
diario_custos_mes AS (
  SELECT
    s.projeto_id,
    date_trunc('month', d.data)::date AS mes,
    COALESCE(SUM(eq.custo_total), 0)  AS custo_diario_equipe,
    COALESCE(SUM(eqp.custo_total), 0) AS custo_diario_equipamentos,
    COALESCE(SUM(vec.custo_diaria), 0) AS custo_diario_veiculos
  FROM public.diarios_obra d
  JOIN public.sites s                    ON s.id = d.site_id
  LEFT JOIN public.diario_equipe eq      ON eq.diario_id  = d.id
  LEFT JOIN public.diario_equipamentos eqp ON eqp.diario_id = d.id
  LEFT JOIN public.diario_veiculos vec   ON vec.diario_id = d.id
  GROUP BY s.projeto_id, date_trunc('month', d.data)::date
),
-- Faturamento mensal por projeto
faturamento_mes AS (
  SELECT
    f.projeto_id,
    date_trunc('month', f.data_emissao)::date AS mes,
    SUM(f.valor_bruto)   AS faturamento_bruto,
    SUM(f.valor_liquido) AS faturamento_liquido,
    COUNT(*)             AS qtd_faturas
  FROM public.faturamentos f
  GROUP BY f.projeto_id, date_trunc('month', f.data_emissao)::date
),
-- Medição mensal por projeto
medicao_mes AS (
  SELECT
    s.projeto_id,
    date_trunc('month', lm.data_medicao)::date AS mes,
    SUM(lm.quantidade * COALESCE(il.preco_unitario, 0)) AS valor_medido,
    COUNT(DISTINCT lm.numero_medicao) AS qtd_medicoes
  FROM public.lancamentos_medicao lm
  JOIN public.sites s     ON s.id = lm.site_id
  JOIN public.itens_lpu il ON il.id = lm.item_lpu_id
  GROUP BY s.projeto_id, date_trunc('month', lm.data_medicao)::date
)
SELECT
  -- Dimensões
  mx.empresa_id,
  mx.empresa_nome,
  mx.area_id,
  mx.area_nome,
  mx.cliente_id,
  mx.cliente_razao_social,
  mx.cliente_cnpj,
  mx.projeto_id,
  mx.projeto_codigo,
  mx.projeto_nome,
  mx.projeto_status,
  mx.projeto_valor_total,
  mx.mes,
  EXTRACT(YEAR  FROM mx.mes)::int AS ano,
  EXTRACT(MONTH FROM mx.mes)::int AS mes_numero,
  to_char(mx.mes, 'YYYY-MM')      AS ano_mes,

  -- Custos ERP por categoria (mensal)
  COALESCE(erp.custo_erp_total, 0)     AS custo_erp_total,
  COALESCE(erp.custo_mao_de_obra, 0)   AS custo_mao_de_obra,
  COALESCE(erp.custo_materiais, 0)     AS custo_materiais,
  COALESCE(erp.custo_equipamentos, 0)  AS custo_equipamentos,
  COALESCE(erp.custo_transporte, 0)    AS custo_transporte,
  COALESCE(erp.custo_indiretos, 0)     AS custo_indiretos,
  COALESCE(erp.custo_financeiros, 0)   AS custo_financeiros,
  COALESCE(erp.custo_outros, 0)        AS custo_outros,

  -- Custos do Diário (fallback / complemento)
  COALESCE(dc.custo_diario_equipe, 0)        AS custo_diario_equipe,
  COALESCE(dc.custo_diario_equipamentos, 0)  AS custo_diario_equipamentos,
  COALESCE(dc.custo_diario_veiculos, 0)      AS custo_diario_veiculos,
  (COALESCE(dc.custo_diario_equipe, 0)
   + COALESCE(dc.custo_diario_equipamentos, 0)
   + COALESCE(dc.custo_diario_veiculos, 0))  AS custo_diario_total,

  -- Custo real consolidado (ERP prioritário, fallback diário)
  CASE
    WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
    ELSE COALESCE(dc.custo_diario_equipe, 0)
       + COALESCE(dc.custo_diario_equipamentos, 0)
       + COALESCE(dc.custo_diario_veiculos, 0)
  END AS custo_real_consolidado,

  -- Produção
  COALESCE(pm.valor_produzido, 0)      AS producao_valor,
  COALESCE(pm.quantidade_produzida, 0) AS producao_quantidade,
  COALESCE(pm.dias_com_diario, 0)      AS dias_com_diario,

  -- Faturamento e Medição
  COALESCE(fm.faturamento_bruto, 0)    AS faturamento_bruto,
  COALESCE(fm.faturamento_liquido, 0)  AS faturamento_liquido,
  COALESCE(fm.qtd_faturas, 0)          AS qtd_faturas,
  COALESCE(mm.valor_medido, 0)         AS valor_medido,
  COALESCE(mm.qtd_medicoes, 0)         AS qtd_medicoes,

  -- Margem bruta mensal (Receita - Custo Real)
  (COALESCE(pm.valor_produzido, 0)
   - CASE
       WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
       ELSE COALESCE(dc.custo_diario_equipe, 0)
          + COALESCE(dc.custo_diario_equipamentos, 0)
          + COALESCE(dc.custo_diario_veiculos, 0)
     END
  ) AS margem_bruta,

  CASE
    WHEN COALESCE(pm.valor_produzido, 0) > 0
    THEN ((COALESCE(pm.valor_produzido, 0)
           - CASE
               WHEN COALESCE(erp.custo_erp_total, 0) > 0 THEN erp.custo_erp_total
               ELSE COALESCE(dc.custo_diario_equipe, 0)
                  + COALESCE(dc.custo_diario_equipamentos, 0)
                  + COALESCE(dc.custo_diario_veiculos, 0)
             END)
          / NULLIF(pm.valor_produzido, 0)) * 100
    ELSE 0
  END AS margem_bruta_percent

FROM matriz mx
LEFT JOIN erp_mes           erp ON erp.projeto_id = mx.projeto_id AND erp.mes = mx.mes
LEFT JOIN producao_mes      pm  ON pm.projeto_id  = mx.projeto_id AND pm.mes  = mx.mes
LEFT JOIN diario_custos_mes dc  ON dc.projeto_id  = mx.projeto_id AND dc.mes  = mx.mes
LEFT JOIN faturamento_mes   fm  ON fm.projeto_id  = mx.projeto_id AND fm.mes  = mx.mes
LEFT JOIN medicao_mes       mm  ON mm.projeto_id  = mx.projeto_id AND mm.mes  = mx.mes
-- Mantém apenas linhas com algum dado
WHERE COALESCE(erp.custo_erp_total, 0) > 0
   OR COALESCE(pm.valor_produzido, 0)  > 0
   OR COALESCE(dc.custo_diario_equipe, 0) + COALESCE(dc.custo_diario_equipamentos, 0) + COALESCE(dc.custo_diario_veiculos, 0) > 0
   OR COALESCE(fm.faturamento_bruto, 0) > 0
   OR COALESCE(mm.valor_medido, 0)      > 0;

GRANT SELECT ON public.view_bi_analise_obras TO service_role;
