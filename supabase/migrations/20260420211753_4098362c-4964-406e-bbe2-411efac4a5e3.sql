-- Grant select on schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant select on all tables and views in public schema to ensure Power BI can see them
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Specifically for the new areas table and its columns
GRANT SELECT ON public.areas TO anon, authenticated, service_role;

-- Specifically for the BI views
GRANT SELECT ON public.view_bi_producao TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_financeiro TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_contratos TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_dim_categoria TO anon, authenticated, service_role;
GRANT SELECT ON public.view_bi_dim_tempo TO anon, authenticated, service_role;

-- Reload schema cache one more time for good measure
NOTIFY pgrst, 'reload schema';