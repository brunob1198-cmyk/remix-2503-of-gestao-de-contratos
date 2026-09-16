-- Cinco views eram legiveis por qualquer um, sem login
--
-- COMO APARECEU
--
-- Roteiro 17.11: "Entrar com usuario de outra empresa -> Nao ve nada do que voce
-- criou. Este e o teste de isolamento e nao e opcional."
--
-- Testar isso com um segundo usuario prova uma tela. O que decide o isolamento e
-- o RLS de cada objeto -- e view NAO herda o RLS das tabelas de baixo. Sem
-- `security_invoker`, ela roda com os privilegios do DONO e enxerga tudo.
--
-- Auditadas as 75 tabelas do SGSST e dos checklists: todas com RLS ligado e
-- politica de SELECT amarrada em empresa. As TABELAS estao certas.
--
-- MEDIDO NO BANCO, NAO NO REPOSITORIO
--
-- Com a chave anonima -- a mesma que vai no pacote publico do frontend, e que
-- qualquer pessoa extrai do navegador -- pedindo so a contagem, zero linhas no
-- corpo:
--
--   projetos, clientes, contratos ............. 0 linhas   (RLS funcionando)
--   view_bi_producao / _analise_obras / _contratos  0      (corrigidas antes)
--
--   view_bi_financeiro ........................ 7100 linhas
--   view_flash_transactions ................... 2243
--   view_public_forecast_flat .................  900
--   vw_resumo_financeiro_site_item ............  210
--   view_public_forecast ......................   36
--
-- view_bi_financeiro ja tinha `security_invoker = on` numa migration de abril.
-- O banco nao estava como o repositorio dizia -- provavelmente um CREATE OR
-- REPLACE posterior, ou a opcao nunca aplicada. E a razao de medir sempre no
-- banco.
--
-- O QUE ESSAS VIEWS MOSTRAM
--
-- Codigo e nome de projeto, RAZAO SOCIAL DO CLIENTE, valor de contrato, total
-- produzido, transacoes e resumo financeiro por site. Nao e metadado: e a
-- carteira de obras e os numeros dela.
--
-- A CORRECAO, EM DUAS CAMADAS
--
-- 1. REVOKE de `anon`. Nenhuma dessas views precisa ser lida sem login.
--
-- 2. `security_invoker = on` em todas. Assim o RLS das tabelas de baixo passa a
--    valer para quem consulta, e um usuario autenticado de outra empresa deixa
--    de enxergar o que nao e dele. So o REVOKE resolveria o anonimo e deixaria
--    esse segundo caso aberto.
--
-- A PAGINA PUBLICA DE FORECAST CONTINUA FUNCIONANDO
--
-- Conferido antes de revogar: /forecast-public nao le a view direto. Ela chama
-- `fetch_public_forecast()`, que e SECURITY DEFINER e segue rodando com o dono.
-- A superficie publica deliberada -- com formato escolhido -- permanece; o que
-- sai e o acesso direto que passava por cima de tudo.
--
-- `authenticated` NAO e revogado: o Power BI le view_bi_financeiro, e com
-- security_invoker cada empresa passa a ver apenas as proprias linhas.

-- ============================================================================
-- 1. Tirar o acesso anonimo
-- ============================================================================

REVOKE SELECT ON public.view_public_forecast       FROM anon;
REVOKE SELECT ON public.view_public_forecast_flat  FROM anon;
REVOKE SELECT ON public.view_flash_transactions    FROM anon;
REVOKE SELECT ON public.vw_resumo_financeiro_site_item FROM anon;
REVOKE SELECT ON public.view_bi_financeiro         FROM anon;

-- As tres ja corrigidas entram no REVOKE tambem. Elas hoje devolvem zero linha
-- porque o security_invoker esta valendo -- e foi exatamente essa opcao que a
-- view_bi_financeiro perdeu em algum momento. Tirar o anonimo faz a protecao
-- deixar de depender de uma unica opcao continuar no lugar.
REVOKE SELECT ON public.view_bi_producao           FROM anon;
REVOKE SELECT ON public.view_bi_analise_obras      FROM anon;
REVOKE SELECT ON public.view_bi_contratos          FROM anon;

-- ============================================================================
-- 2. Fazer a view respeitar o RLS de quem consulta
-- ============================================================================

ALTER VIEW public.view_public_forecast            SET (security_invoker = on);
ALTER VIEW public.view_public_forecast_flat       SET (security_invoker = on);
ALTER VIEW public.view_flash_transactions         SET (security_invoker = on);
ALTER VIEW public.vw_resumo_financeiro_site_item  SET (security_invoker = on);
ALTER VIEW public.view_bi_financeiro              SET (security_invoker = on);

-- As tres ja corrigidas: reafirmadas aqui porque uma delas ja perdeu a opcao uma
-- vez, e reaplicar e barato.
ALTER VIEW public.view_bi_producao                SET (security_invoker = on);
ALTER VIEW public.view_bi_analise_obras           SET (security_invoker = on);
ALTER VIEW public.view_bi_contratos               SET (security_invoker = on);

-- ============================================================================
-- 3. Como conferir que fechou
-- ============================================================================
--
-- Nenhuma destas deve devolver linha para o papel `anon`:
--
--   SELECT c.relname,
--          COALESCE(c.reloptions::text, '(sem opcoes)') AS opcoes,
--          has_table_privilege('anon', c.oid, 'SELECT') AS anon_le
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind = 'v'
--    ORDER BY anon_le DESC, c.relname;
--
-- `anon_le` tem de sair false em todas as views desta migration, e `opcoes`
-- precisa conter security_invoker=on.
