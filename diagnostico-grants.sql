-- Diagnóstico: quem realmente tem acesso às views de BI e às funções expostas.
-- Rode no SQL Editor. É só leitura, não altera nada.
--
-- O que procurar: linhas com grantee = 'PUBLIC'. Se aparecerem, confirmam por que
-- o REVOKE ... FROM anon não surtiu efeito — todo role herda de PUBLIC.

-- 1. Grants nas views de BI
SELECT
  table_name  AS objeto,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'view_bi_producao', 'view_bi_analise_obras', 'view_bi_financeiro',
    'view_bi_dim_tempo', 'view_bi_dim_categoria', 'view_quadro_geral_bi',
    'view_bi_contratos', 'view_contratos', 'view_producao_diario'
  )
ORDER BY table_name, grantee;

-- 2. Grants nas funções (aqui o PUBLIC aparece como string vazia em acl)
SELECT
  p.proname AS funcao,
  pg_get_userbyid(p.proowner) AS dono,
  COALESCE(array_to_string(p.proacl, E'\n'), '(sem acl explicita = PUBLIC pode executar)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_quadro_geral_bi', 'gerar_proximo_numero_sc', 'get_user_empresa_id',
    'get_user_role', 'is_user_approved', 'count_fotos_periodo',
    'resumo_rdo_periodo', 'sum_producao_periodo', 'sum_producao_por_item'
  )
ORDER BY p.proname;

-- 3. Confirma se o security_invoker ficou ligado nas duas views
SELECT
  c.relname AS view_name,
  COALESCE(
    (SELECT option_value
     FROM pg_options_to_table(c.reloptions)
     WHERE option_name = 'security_invoker'),
    'off (padrao)'
  ) AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('view_bi_producao', 'view_bi_analise_obras');

-- 4. Confirma se as 16 migrations do SGSST ficaram registradas
SELECT count(*) AS versoes_sgsst_registradas
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260813183000','20260813190000','20260813193000','20260813200000',
  '20260813203000','20260813210000','20260813213000','20260813220000',
  '20260813230000','20260813240000','20260814000000','20260814010000',
  '20260814020000','20260814030000','20260814050000','20260819000000'
);
