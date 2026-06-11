CREATE OR REPLACE VIEW public.view_public_forecast AS
WITH producao_mensal AS (
  SELECT 
    projeto_id,
    jsonb_object_agg(mes_chave, valor_total) AS dados
  FROM (
    SELECT projeto_id, TO_CHAR(data_producao, 'YYYY-MM') as mes_chave, sum(valor_total) as valor_total
    FROM public.view_bi_producao
    GROUP BY projeto_id, TO_CHAR(data_producao, 'YYYY-MM')
  ) s
  GROUP BY projeto_id
)
SELECT 
    p.id AS projeto_id,
    p.nome AS projeto_nome,
    p.status AS projeto_status,
    p.valor_total AS valor_contrato,
    c.razao_social AS cliente_nome,
    a.nome AS area_nome,
    COALESCE((SELECT SUM(valor_total) FROM public.view_bi_producao WHERE projeto_id = p.id), 0) AS total_produzido,
    pm.dados AS producao_mensal,
    p.forecast_data AS forecast_data
FROM public.projetos p
LEFT JOIN public.clientes c ON p.cliente_id = c.id
LEFT JOIN public.areas a ON p.area_id = a.id
LEFT JOIN producao_mensal pm ON pm.projeto_id = p.id;

GRANT SELECT ON public.view_public_forecast TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fetch_public_forecast()
RETURNS SETOF public.view_public_forecast
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.view_public_forecast;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_public_forecast() TO anon, authenticated, service_role;