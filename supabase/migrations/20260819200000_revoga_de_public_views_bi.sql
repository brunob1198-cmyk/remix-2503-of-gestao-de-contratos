-- Migration: revoga tambem de PUBLIC as views de BI e as funcoes expostas
--
-- POR QUE ESTA MIGRATION EXISTE: a 20260819191000 revogou de `anon` e
-- `authenticated`, e nao surtiu efeito. Verificado depois de aplicada:
--
--   view_quadro_geral_bi        anon ainda le, com conteudo real
--   get_quadro_geral_bi()       anon ainda executa
--   gerar_proximo_numero_sc()   anon ainda executa (chega a bater na trava)
--
-- A causa e a role PUBLIC. No Postgres todo role e membro implicito de PUBLIC,
-- entao um `GRANT ... TO PUBLIC` concede a todos — e `REVOKE ... FROM anon` nao
-- remove esse caminho. A prova esta na 20260819190000: o CREATE OR REPLACE dela
-- pegou (a trava responde 42501), mas o REVOKE FROM anon do mesmo arquivo nao
-- impediu o anonimo de executar. Se o acesso viesse do grant direto de anon, o
-- REVOKE teria funcionado.
--
-- Aqui revogamos de PUBLIC e so depois concedemos, de forma explicita, a quem
-- precisa. Ordem importa: revogar primeiro, conceder depois.

-- =====================================================================
-- 1. Views consumidas pelo frontend (usuario autenticado)
-- =====================================================================
REVOKE ALL ON public.view_bi_producao      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_bi_analise_obras FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.view_bi_producao      TO authenticated;
GRANT SELECT ON public.view_bi_analise_obras TO authenticated;

-- =====================================================================
-- 2. Views que so o Power BI consome, via service_role
-- =====================================================================
REVOKE ALL ON public.view_bi_financeiro    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_bi_dim_tempo     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_bi_dim_categoria FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_quadro_geral_bi  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_bi_contratos     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_contratos        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.view_producao_diario  FROM PUBLIC, anon, authenticated;

-- service_role explicito, para o Power BI nao depender de heranca implicita.
GRANT SELECT ON public.view_bi_financeiro    TO service_role;
GRANT SELECT ON public.view_bi_dim_tempo     TO service_role;
GRANT SELECT ON public.view_bi_dim_categoria TO service_role;
GRANT SELECT ON public.view_quadro_geral_bi  TO service_role;
GRANT SELECT ON public.view_bi_contratos     TO service_role;
GRANT SELECT ON public.view_contratos        TO service_role;
GRANT SELECT ON public.view_producao_diario  TO service_role;
GRANT SELECT ON public.view_bi_producao      TO service_role;
GRANT SELECT ON public.view_bi_analise_obras TO service_role;

-- =====================================================================
-- 3. Funcoes: mesma correcao
-- =====================================================================

-- RPC morta do quadro geral: expunha 382 linhas com valores de contrato.
REVOKE ALL ON FUNCTION public.get_quadro_geral_bi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quadro_geral_bi() TO service_role;

-- Helpers de RLS: as policies os chamam internamente como definer e nao precisam
-- do grant. Expostos, permitem descobrir empresa e papel de qualquer usuario.
REVOKE ALL ON FUNCTION public.get_user_empresa_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_role(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_user_approved(uuid)    FROM PUBLIC, anon, authenticated;

-- has_role e user_can_access_* tambem sao chamados de dentro de policies.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- gerar_proximo_numero_sc: mantem a trava de tenant e sai do alcance do anonimo.
REVOKE ALL ON FUNCTION public.gerar_proximo_numero_sc(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_proximo_numero_sc(uuid, text) TO authenticated;

-- Agregadores que recebem arrays de UUID sem validar tenant.
REVOKE ALL ON FUNCTION public.count_fotos_periodo(uuid[], date, date)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resumo_rdo_periodo(uuid[], date, date)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sum_producao_periodo(uuid[], date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sum_producao_por_item(uuid[])            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.count_fotos_periodo(uuid[], date, date)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_rdo_periodo(uuid[], date, date)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_producao_periodo(uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_producao_por_item(uuid[])            TO authenticated;

-- view_public_forecast e _flat ficam abertas: previsao do tempo, publicas por
-- desenho, e o nome declara isso.
