-- Grant access to the view
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated;

-- Grant execution permissions to the underlying function just in case
GRANT EXECUTE ON FUNCTION public.get_bi_analise_obras() TO anon, authenticated;

-- Ensure public schema is accessible
GRANT USAGE ON SCHEMA public TO anon, authenticated;
