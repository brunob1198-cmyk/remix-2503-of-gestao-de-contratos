-- Migration: fecha o acesso anonimo as views de BI e a RPC morta do quadro geral
--
-- ACHADO (verificado em 19/08/2026 com a chave anon, que e publica por estar no
-- bundle do frontend): as 11 views de BI respondiam HTTP 200 sem nenhum login.
--
--   view_bi_financeiro        6.506 linhas
--   view_bi_dim_tempo         2.557 linhas
--   view_bi_producao          1.754 linhas
--   view_producao_diario      1.754 linhas
--   view_quadro_geral_bi        382 linhas  (Cliente, Valor Contrato,
--                                            Valor Faturado, Saldo Contrato)
--   view_bi_dim_categoria       139 linhas
--
-- E a funcao get_quadro_geral_bi() devolvia as mesmas 382 linhas anonimamente.
-- Ela e codigo morto: nada em src/ a chama, e o Power BI le a VIEW, nao a funcao.
--
-- POR QUE E SEGURO REVOGAR ANON:
--   - O Power BI passa pela edge function powerbi-data, que usa
--     SUPABASE_SERVICE_ROLE_KEY. service_role ignora grants e RLS.
--   - O frontend sempre opera com sessao autenticada, nunca como anon.
--   - Nenhum consumidor legitimo de anon foi encontrado.
--
-- ESCOPO DESTA MIGRATION: apenas revogar. Nao altera definicao de view nem de
-- funcao (fora a RPC morta, que perde o grant). Ver a NOTA no fim sobre o passo
-- seguinte, que exige decisao de produto.

-- 1. Views consumidas pelo frontend: authenticated mantem, anon sai.
REVOKE ALL ON public.view_bi_producao FROM anon;
REVOKE ALL ON public.view_bi_analise_obras FROM anon;

-- 2. Views que so o Power BI consome (service_role): anon e authenticated saem.
--    Nenhuma referencia a elas em src/, fora os tipos gerados.
REVOKE ALL ON public.view_bi_financeiro FROM anon, authenticated;
REVOKE ALL ON public.view_bi_dim_tempo FROM anon, authenticated;
REVOKE ALL ON public.view_bi_dim_categoria FROM anon, authenticated;
REVOKE ALL ON public.view_quadro_geral_bi FROM anon, authenticated;
REVOKE ALL ON public.view_bi_contratos FROM anon, authenticated;
REVOKE ALL ON public.view_contratos FROM anon, authenticated;
REVOKE ALL ON public.view_producao_diario FROM anon, authenticated;

-- 3. view_public_forecast / _flat ficam como estao: sao previsao do tempo,
--    publicas por desenho, e o proprio nome declara isso.

-- 4. RPC morta do quadro geral: expunha 382 linhas com valores de contrato por
--    cliente. Ninguem chama. Revoga em vez de dropar, para ser reversivel.
REVOKE EXECUTE ON FUNCTION public.get_quadro_geral_bi() FROM anon, authenticated;

-- 5. Helpers de RLS: as policies os chamam internamente como definer e nao
--    precisam do grant. Expostos por RPC, permitiam descobrir a empresa e o
--    papel de qualquer usuario a partir do UUID dele.
REVOKE EXECUTE ON FUNCTION public.get_user_empresa_id(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM anon, authenticated;

-- 6. Agregadores que recebem arrays de UUID sem validar tenant. Com IDs reais de
--    outra empresa devolveriam producao e contagem de fotos dela. O frontend usa
--    os proprios IDs; anon nao tem motivo para chamar.
REVOKE EXECUTE ON FUNCTION public.count_fotos_periodo(uuid[], date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resumo_rdo_periodo(uuid[], date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sum_producao_periodo(uuid[], date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sum_producao_por_item(uuid[]) FROM anon;

-- NOTA — passo seguinte, que NAO esta nesta migration porque muda comportamento:
--
-- Revogar anon fecha o acesso de quem nao tem login. Nao resolve o caso de um
-- usuario autenticado da empresa A ler dados da empresa B: as views rodam com o
-- privilegio do dono e, por padrao, ignoram o RLS das tabelas de base. E o que o
-- linter chama de "security definer views".
--
-- A correcao e ligar o security_invoker nas views que o frontend consome, para
-- que o RLS do chamador passe a valer:
--
--   ALTER VIEW public.view_bi_producao      SET (security_invoker = on);
--   ALTER VIEW public.view_bi_analise_obras SET (security_invoker = on);
--
-- Isso muda o que cada usuario ve, entao exige testar os relatorios que dependem
-- dessas views (ProducaoMensal, QuadroGeral, useForecast e o Dashboard de
-- medicoes) antes de aplicar. O Power BI nao e afetado: service_role ignora RLS.
