-- Garantir permissões para a função
GRANT EXECUTE ON FUNCTION public.get_bi_analise_obras() TO anon, authenticated;

-- Garantir permissões para a view
GRANT SELECT ON public.view_bi_analise_obras TO anon, authenticated;

-- Garantir que o schema public está acessível
GRANT USAGE ON SCHEMA public TO anon, authenticated;
