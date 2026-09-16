-- Reabre as views ao acesso anonimo — DECISAO EXPLICITA DO DONO DO SISTEMA
--
-- ISTO NAO E UM DESCUIDO. NAO "CORRIJA" SEM FALAR COM ELE.
--
-- A migration 20260916230000 fechou o acesso anonimo a oito views, depois de
-- medir que cinco delas devolviam dados reais para a chave publica do frontend:
--
--   view_bi_financeiro ........... 7100 linhas
--   view_flash_transactions ...... 2243
--   view_public_forecast_flat ....  900
--   vw_resumo_financeiro_site_item  210
--   view_public_forecast .........   36
--
-- O dono do sistema pediu a reversao, com motivo declarado: essas views
-- alimentam um Power BI externo, e o acesso anonimo foi a forma mais rapida de
-- fazer o vinculo funcionar. O fechamento derrubou o relatorio dele.
--
-- O QUE ISSO SIGNIFICA, PARA QUEM LER DEPOIS
--
-- A chave anonima do Supabase viaja no pacote JavaScript do frontend. Qualquer
-- pessoa que abra o site extrai essa chave do navegador em segundos. Com ela, o
-- conteudo destas views e legivel por qualquer um, sem login: codigo e nome de
-- projeto, razao social do cliente, valor de contrato, total produzido,
-- transacoes e resumo financeiro por site.
--
-- Nao ha filtro por empresa nessas views: quem le, le tudo.
--
-- ALTERNATIVAS QUE MANTEM O POWER BI FUNCIONANDO
--
-- Registradas aqui para quando houver tempo, e nao como cobranca:
--
--   a) `service_role` em vez de `anon`. O Power BI guarda a chave na conexao,
--      que nao e publica. Troca de uma linha na origem de dados.
--   b) Papel proprio, so de leitura, com chave propria -- revogavel sem mexer
--      no aplicativo.
--   c) Manter `security_invoker` e dar ao Power BI um usuario autenticado da
--      empresa: as views passam a filtrar por empresa sozinhas.
--
-- O QUE ESTA MIGRATION FAZ
--
-- Restaura o estado exato anterior a 20260916230000, e nao "abre tudo":
--
--   * devolve o SELECT ao papel `anon` nas oito views;
--   * tira o `security_invoker` das CINCO que nao o tinham -- sem isso o anonimo
--     entraria e receberia zero linha, e o Power BI quebraria igual;
--   * MANTEM o `security_invoker` nas tres que ja o tinham antes
--     (view_bi_producao, view_bi_analise_obras, view_bi_contratos). Elas ja
--     devolviam zero linha ao anonimo antes de tudo isto, ou seja, o Power BI
--     nao depende delas.

-- ============================================================================
-- 1. Devolver o acesso anonimo
-- ============================================================================

GRANT SELECT ON public.view_public_forecast            TO anon;
GRANT SELECT ON public.view_public_forecast_flat       TO anon;
GRANT SELECT ON public.view_flash_transactions         TO anon;
GRANT SELECT ON public.vw_resumo_financeiro_site_item  TO anon;
GRANT SELECT ON public.view_bi_financeiro              TO anon;

GRANT SELECT ON public.view_bi_producao                TO anon;
GRANT SELECT ON public.view_bi_analise_obras           TO anon;
GRANT SELECT ON public.view_bi_contratos               TO anon;

-- ============================================================================
-- 2. Tirar o security_invoker das cinco que nao o tinham
-- ============================================================================
--
-- Sem isto o GRANT acima nao adianta: o RLS das tabelas de baixo passaria a
-- valer para o `anon`, que nao tem empresa, e toda consulta voltaria vazia.

ALTER VIEW public.view_public_forecast            RESET (security_invoker);
ALTER VIEW public.view_public_forecast_flat       RESET (security_invoker);
ALTER VIEW public.view_flash_transactions         RESET (security_invoker);
ALTER VIEW public.vw_resumo_financeiro_site_item  RESET (security_invoker);
ALTER VIEW public.view_bi_financeiro              RESET (security_invoker);

-- As tres abaixo NAO sao tocadas de proposito: ja tinham security_invoker antes
-- de 20260916230000, e tirar agora abriria algo que nunca esteve aberto.
--   view_bi_producao, view_bi_analise_obras, view_bi_contratos
