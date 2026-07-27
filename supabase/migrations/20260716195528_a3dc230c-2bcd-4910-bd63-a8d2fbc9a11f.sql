CREATE OR REPLACE VIEW public.view_public_forecast_flat AS
WITH meses AS (
  SELECT to_char(date_trunc('month', CURRENT_DATE) + ((n || ' month')::interval), 'YYYY-MM') AS mes_chave,
         to_char(date_trunc('month', CURRENT_DATE) + ((n || ' month')::interval), 'mon/YY') AS mes_label
    FROM generate_series(-12, 12) n
), dados_projeto AS (
  SELECT p.id AS projeto_id, p.codigo AS projeto_codigo, p.nome AS projeto_nome,
         c.razao_social AS cliente_nome, a.nome AS area_nome, p.status AS projeto_status,
         p.valor_total AS valor_contrato, p.forecast_data,
         COALESCE((SELECT sum(v.valor_total) FROM view_bi_producao v WHERE v.projeto_id = p.id), 0) AS total_produzido
    FROM projetos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    LEFT JOIN areas a ON p.area_id = a.id
), producao_mensal AS (
  SELECT projeto_id, substring(data_producao::text, 1, 7) AS mes, sum(valor_total) AS valor
    FROM view_bi_producao
   GROUP BY projeto_id, substring(data_producao::text, 1, 7)
), mes_atual AS (
  SELECT to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM') AS mes_chave
), forecast_expandido AS (
  SELECT p.id AS projeto_id,
         m.mes_chave,
         CASE WHEN m.mes_chave >= (SELECT mes_chave FROM mes_atual)
              THEN COALESCE((p.forecast_data ->> m.mes_chave)::numeric, 0)
              ELSE 0 END AS valor_forecast,
         CASE WHEN m.mes_chave < (SELECT mes_chave FROM mes_atual)
              THEN COALESCE(prod.valor, 0)
              ELSE 0 END AS valor_real
    FROM projetos p
    CROSS JOIN meses m
    LEFT JOIN producao_mensal prod ON prod.projeto_id = p.id AND prod.mes = m.mes_chave
)
SELECT dp.projeto_id, dp.projeto_codigo, dp.projeto_nome, dp.cliente_nome, dp.area_nome,
       dp.projeto_status, dp.valor_contrato, dp.forecast_data, dp.total_produzido,
       fe.mes_chave, fe.valor_real, fe.valor_forecast,
       (fe.valor_real + fe.valor_forecast) AS valor_total_mes
  FROM dados_projeto dp
  JOIN forecast_expandido fe ON fe.projeto_id = dp.projeto_id;

GRANT SELECT ON public.view_public_forecast_flat TO anon, authenticated, service_role;