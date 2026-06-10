-- Create a more accessible view for public data
CREATE OR REPLACE VIEW public.view_public_forecast AS
SELECT 
    p.id as projeto_id,
    p.codigo as projeto_codigo,
    p.nome as projeto_nome,
    c.razao_social as cliente_nome,
    a.nome as area_nome,
    p.status as projeto_status,
    p.valor_total as valor_contrato,
    p.forecast_data,
    (
        SELECT COALESCE(SUM(v.valor_total), 0)
        FROM view_bi_producao v
        WHERE v.projeto_id = p.id
    ) as total_produzido,
    (
        SELECT jsonb_object_agg(month, monthly_total)
        FROM (
            SELECT 
                substring(data_producao::text, 1, 7) as month,
                SUM(valor_total) as monthly_total
            FROM view_bi_producao
            WHERE projeto_id = p.id
            GROUP BY month
        ) sub
    ) as producao_mensal
FROM projetos p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN areas a ON p.area_id = a.id;

-- Grant access to the view
GRANT SELECT ON public.view_public_forecast TO anon;
GRANT SELECT ON public.view_public_forecast TO authenticated;
GRANT SELECT ON public.view_public_forecast TO service_role;

-- Create a function to fetch this data easily via RPC
CREATE OR REPLACE FUNCTION public.fetch_public_forecast()
RETURNS SETOF public.view_public_forecast
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.view_public_forecast;
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.fetch_public_forecast() TO anon;
GRANT EXECUTE ON FUNCTION public.fetch_public_forecast() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_public_forecast() TO service_role;
