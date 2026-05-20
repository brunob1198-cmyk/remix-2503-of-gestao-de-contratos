-- Garantir que o proprietário da view seja o postgres (admin)
ALTER VIEW public.view_bi_analise_obras OWNER TO postgres;

-- Conceder acesso de leitura
GRANT SELECT ON public.view_bi_analise_obras TO anon;
GRANT SELECT ON public.view_bi_analise_obras TO authenticated;

-- Garantir que a função também seja acessível
GRANT EXECUTE ON FUNCTION public.get_bi_analise_obras() TO anon;
GRANT EXECUTE ON FUNCTION public.get_bi_analise_obras() TO authenticated;