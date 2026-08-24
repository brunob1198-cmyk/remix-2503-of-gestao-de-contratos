# Aplicar UMA migration do SGSST no banco (Fase 3)

Preciso que você execute **apenas** o SQL do bloco no final deste prompt,
diretamente no banco. É a migration `20260820160000_pgr_completo_nr01.sql`.

## Regras — leia antes de agir

1. **NÃO rode `supabase db push`.** O histórico de migrations deste projeto está
   dessincronizado e migrations antigas contêm comandos destrutivos: `DELETE FROM
   public.flash_normalizacao`, `DELETE FROM public.flash_transactions_raw`,
   `ALTER TABLE projeto_impostos DROP COLUMN perc_total_impostos`, `DROP TABLE IF
   EXISTS mkp_parametros CASCADE`, `DROP TABLE IF EXISTS timeline_eventos`. Um
   push rodaria isso na base de produção.
2. **Execute só o SQL abaixo.** Nada de DDL extra.
3. **Não altere nenhum arquivo** em `src/**` ou `supabase/migrations/**`. O código
   já está mergeado em `main`; o que falta é só o banco.
4. Depois de executar, registre a versão em
   `supabase_migrations.schema_migrations` com `INSERT ... ON CONFLICT DO
   NOTHING`, usando a versão `20260820160000`.
5. Se algo falhar, **pare e me relate o erro** em vez de tentar contornar.

## O que esta migration faz

**1. Colunas novas em `public.sgsst_pgr_inventario`** — as alíneas que faltavam ao
inventário de riscos da NR-01 1.5.7.3.2: `tipo_exposicao` (com CHECK
HABITUAL/OCASIONAL/EVENTUAL), `tempo_exposicao`, `descricao_local`,
`grupos_expostos`, `intensidade_medida`, `unidade_medida`,
`limite_tolerancia_aplicado`, `tecnica_avaliacao` (CHECK
QUALITATIVA/QUANTITATIVA), `data_medicao`, `resultado_avaliacao` (CHECK
ABAIXO_LIMITE/ACIMA_LIMITE/NAO_APLICAVEL) e `metodologia_medicao`.

**2. Tabela nova `public.sgsst_pgr_inventario_funcoes`** — quais funções estão
expostas a cada item do inventário. Com RLS (4 policies), trigger de auditoria e
trigger de integridade de tenant.

**3. Colunas novas em `public.sgsst_pgr_medidas_controle`** — o que a NR-01
1.5.5.2 pede junto com a medida: `forma_acompanhamento`, `verificador_id` (FK
para `profiles`), `data_verificacao`, `resultado_verificacao` (CHECK
EFICAZ/PARCIALMENTE_EFICAZ/INEFICAZ) e `observacao_verificacao`.

**4. Colunas novas em `public.sgsst_pgr`** — `periodicidade_revisao_meses`
(NOT NULL DEFAULT 24), `versao` (NOT NULL DEFAULT 1), `empresa_nome`,
`empresa_cnpj`, `responsavel_tecnico`, `registro_responsavel` e `metodologia`.
Há um `UPDATE` que retro-preenche nome e CNPJ da empresa nos PGRs existentes.

**5. Tabela nova `public.sgsst_pgr_historico`** — o PGR era o único módulo SGSST
sem histórico, justamente o documento que a NR-01 1.5.7.3.3 manda guardar por 20
anos com histórico das atualizações. **Ela tem só 2 policies (SELECT e INSERT),
de propósito**: histórico que pode ser editado ou apagado não serve como
histórico. Isso é intencional, não um esquecimento.

**6. Trigger `fn_sgsst_pgr_historico`** — registra criação, mudança de status,
nova versão e revisão. Em trigger e não na aplicação, para alteração vinda de
script ou do painel do Supabase também aparecer.

**7. Semeia o histórico retroativo** dos PGRs que já existiam, com
`WHERE NOT EXISTS`, para eles não aparecerem sem nenhum registro.

Tudo é idempotente: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de cada `CREATE
POLICY`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`. Não há `DROP
TABLE`, não há `DELETE`.

Depende de objetos que já existem: `public.empresas`, `public.sgsst_pgr`,
`public.sgsst_pgr_inventario`, `public.sgsst_pgr_medidas_controle`,
`public.sgsst_funcoes`, `public.profiles`, a função
`public.get_user_empresa_id` e o trigger `fn_audit_trigger`.

## Como confirmar que deu certo

Rode esta verificação e me mande o resultado:

```sql
-- 1) As duas tabelas novas existem, com RLS e a contagem esperada de policies?
--    sgsst_pgr_historico deve ter 2 (SELECT e INSERT). As outras, 4.
SELECT c.relname AS tabela, c.relrowsecurity AS rls_ligado,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('sgsst_pgr_inventario_funcoes','sgsst_pgr_historico')
ORDER BY c.relname;

-- 2) As colunas novas chegaram?
SELECT table_name, count(*) AS colunas_novas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'sgsst_pgr_inventario' AND column_name IN
      ('tipo_exposicao','tempo_exposicao','descricao_local','grupos_expostos',
       'intensidade_medida','unidade_medida','limite_tolerancia_aplicado',
       'tecnica_avaliacao','data_medicao','resultado_avaliacao','metodologia_medicao'))
    OR (table_name = 'sgsst_pgr_medidas_controle' AND column_name IN
      ('forma_acompanhamento','verificador_id','data_verificacao',
       'resultado_verificacao','observacao_verificacao'))
    OR (table_name = 'sgsst_pgr' AND column_name IN
      ('periodicidade_revisao_meses','versao','empresa_nome','empresa_cnpj',
       'responsavel_tecnico','registro_responsavel','metodologia'))
  )
GROUP BY table_name ORDER BY table_name;

-- 3) O histórico retroativo foi semeado?
SELECT count(*) AS registros_historico FROM public.sgsst_pgr_historico;
```

Esperado:
- `sgsst_pgr_inventario_funcoes` com `rls_ligado = true` e `policies = 4`
- `sgsst_pgr_historico` com `rls_ligado = true` e `policies = 2`
- `sgsst_pgr` → 7 colunas, `sgsst_pgr_inventario` → 11, `sgsst_pgr_medidas_controle` → 5
- `registros_historico` igual ao número de PGRs que já existiam (pode ser `0` se não houver nenhum)

---

## SQL a executar

```sql
-- Migration: PGR completo pela NR-01 (Fase 3 do plano de Seguranca)
--
-- Tres frentes:
--
--   1. INVENTARIO DE RISCOS (NR-01 1.5.7.3.2). Das 9 alineas, 5 estavam
--      atendidas, 2 parcialmente e 2 ausentes:
--        - AUSENTE: caracterizacao da exposicao (habitual/ocasional e duracao).
--        - AUSENTE: dados de monitoramento (intensidade medida, limite aplicado,
--          tecnica de avaliacao).
--        - PARCIAL: `trabalhadores_expostos` guardava um NUMERO, mas a norma pede
--          QUAIS GRUPOS estao expostos. Numero nao identifica ninguem.
--        - PARCIAL: so havia `area_id`, sem descricao do ambiente.
--
--   2. PLANO DE ACAO (NR-01 1.5.5.2). Havia medida, tipo, responsavel e prazo.
--      Faltavam as duas coisas que a norma pede junto: "formas de
--      acompanhamento" e "afericao dos resultados".
--
--   3. HISTORICO. O PGR era o UNICO dos dez modulos SGSST sem tabela de
--      historico — justamente o documento que a norma manda manter por 20 anos
--      COM historico das atualizacoes (1.5.7.3.3).

-- =====================================================================
-- 1. Inventario: as alineas que faltavam
-- =====================================================================
ALTER TABLE public.sgsst_pgr_inventario
  -- Alinea da caracterizacao da exposicao.
  ADD COLUMN IF NOT EXISTS tipo_exposicao text
    CHECK (tipo_exposicao IS NULL OR tipo_exposicao IN ('HABITUAL', 'OCASIONAL', 'EVENTUAL')),
  ADD COLUMN IF NOT EXISTS tempo_exposicao text,

  -- Descricao do ambiente. `area_id` diz onde no cadastro; isto diz como e o
  -- lugar (ventilacao, confinamento, iluminacao), que e o que o fiscal le.
  ADD COLUMN IF NOT EXISTS descricao_local text,

  -- Grupos expostos em texto, para o caso de grupo que nao corresponde a uma
  -- funcao cadastrada (visitantes, terceiros de empreiteira). A identificacao
  -- estruturada vai na tabela de ligacao adiante.
  ADD COLUMN IF NOT EXISTS grupos_expostos text,

  -- Alinea dos dados de monitoramento. Sem isto o inventario afirma que o risco
  -- e "moderado" sem nenhuma medicao por tras.
  ADD COLUMN IF NOT EXISTS intensidade_medida numeric,
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS limite_tolerancia_aplicado numeric,
  ADD COLUMN IF NOT EXISTS tecnica_avaliacao text
    CHECK (tecnica_avaliacao IS NULL OR tecnica_avaliacao IN ('QUALITATIVA', 'QUANTITATIVA')),
  ADD COLUMN IF NOT EXISTS data_medicao date,
  -- O resultado e declarado, nao calculado: para oxigenio em espaco confinado a
  -- NR-33 exige atmosfera ENTRE 20,9% e 23%, entao tanto falta quanto excesso
  -- reprovam. Um `medida > limite` generico daria "conforme" no caso que mata.
  ADD COLUMN IF NOT EXISTS resultado_avaliacao text
    CHECK (resultado_avaliacao IS NULL OR resultado_avaliacao IN
      ('ABAIXO_LIMITE', 'ACIMA_LIMITE', 'NAO_APLICAVEL')),
  ADD COLUMN IF NOT EXISTS metodologia_medicao text;

COMMENT ON COLUMN public.sgsst_pgr_inventario.tipo_exposicao IS
  'HABITUAL/OCASIONAL/EVENTUAL. Caracterizacao da exposicao exigida pela NR-01 1.5.7.3.2. Herdado de sgsst_funcao_riscos quando o risco vem de uma funcao.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.trabalhadores_expostos IS
  'QUANTIDADE de expostos. A norma pede tambem QUAIS grupos — ver grupos_expostos e a tabela sgsst_pgr_inventario_funcoes.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.resultado_avaliacao IS
  'Declarado por quem avalia, nao calculado. Ha agente cujo limite e piso e nao teto (oxigenio, NR-33), onde comparar por "maior que" inverteria a conclusao.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.limite_tolerancia_aplicado IS
  'Limite usado NESTA avaliacao. Copiado do catalogo no momento do lancamento, nao lido por join: se o catalogo mudar depois, o inventario nao pode mudar retroativamente.';

-- =====================================================================
-- 2. Grupos expostos: quais funcoes, nao quantas pessoas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_inventario_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL REFERENCES public.sgsst_pgr_inventario(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_pgr_inventario_funcoes IS
  'Grupos de trabalhadores expostos ao item do inventario, identificados por funcao. NR-01 1.5.7.3.2 pede QUAIS grupos, e a fase 2 ja sabe quais funcoes se expoem a cada risco — a tela sugere a partir dali.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_pgr_inv_funcoes
  ON public.sgsst_pgr_inventario_funcoes(inventario_id, funcao_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_empresa
  ON public.sgsst_pgr_inventario_funcoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_inv
  ON public.sgsst_pgr_inventario_funcoes(inventario_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_funcao
  ON public.sgsst_pgr_inventario_funcoes(funcao_id);

ALTER TABLE public.sgsst_pgr_inventario_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users view own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users insert own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users update own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users delete own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pgr_inventario_funcoes ON public.sgsst_pgr_inventario_funcoes;
CREATE TRIGGER audit_sgsst_pgr_inventario_funcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pgr_inventario_funcoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_pgr_inv_funcoes_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_pgr_inventario
    WHERE id = NEW.inventario_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O item de inventário informado não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_funcoes
    WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_pgr_inv_funcoes_tenant_check ON public.sgsst_pgr_inventario_funcoes;
CREATE TRIGGER trg_sgsst_pgr_inv_funcoes_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pgr_inventario_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_pgr_inv_funcoes_tenant_integrity();

-- =====================================================================
-- 3. Plano de acao: acompanhamento e afericao (NR-01 1.5.5.2)
-- =====================================================================
ALTER TABLE public.sgsst_pgr_medidas_controle
  ADD COLUMN IF NOT EXISTS forma_acompanhamento text,
  ADD COLUMN IF NOT EXISTS verificador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_verificacao date,
  -- Tres valores, nao ACEITA/REJEITADA como nas nao conformidades: medida de
  -- controle costuma funcionar em parte, e forcar binario esconderia justamente
  -- o caso que precisa de reforco.
  ADD COLUMN IF NOT EXISTS resultado_verificacao text
    CHECK (resultado_verificacao IS NULL OR resultado_verificacao IN
      ('EFICAZ', 'PARCIALMENTE_EFICAZ', 'INEFICAZ')),
  ADD COLUMN IF NOT EXISTS observacao_verificacao text;

COMMENT ON COLUMN public.sgsst_pgr_medidas_controle.forma_acompanhamento IS
  'Como o cumprimento da medida sera acompanhado. NR-01 1.5.5.2 exige no plano de acao.';
COMMENT ON COLUMN public.sgsst_pgr_medidas_controle.resultado_verificacao IS
  'Afericao dos resultados exigida pela NR-01 1.5.5.2: a medida implantada de fato reduziu o risco? PARCIALMENTE_EFICAZ existe porque medida de controle costuma funcionar em parte.';

-- =====================================================================
-- 4. Revisao periodica (NR-01 1.5.4.4.5)
-- =====================================================================
ALTER TABLE public.sgsst_pgr
  -- 24 meses e a regra geral. A norma admite 3 anos quando ha sistema de gestao
  -- de SST certificado, entao o prazo e dado, nao constante no codigo.
  ADD COLUMN IF NOT EXISTS periodicidade_revisao_meses integer NOT NULL DEFAULT 24
    CHECK (periodicidade_revisao_meses > 0),
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  -- Congelamento da identificacao da organizacao na emissao: ler de `empresas`
  -- na hora de imprimir faria PGRs antigos passarem a mostrar o nome novo.
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  -- Quem responde tecnicamente pelo documento, com registro profissional.
  ADD COLUMN IF NOT EXISTS responsavel_tecnico text,
  ADD COLUMN IF NOT EXISTS registro_responsavel text,
  ADD COLUMN IF NOT EXISTS metodologia text;

COMMENT ON COLUMN public.sgsst_pgr.periodicidade_revisao_meses IS
  'NR-01 1.5.4.4.5: revisao a cada 2 anos, ou 3 anos com sistema de gestao de SST certificado. Guardado como dado para o alerta respeitar o caso de 3 anos.';
COMMENT ON COLUMN public.sgsst_pgr.data_revisao IS
  'Data da ULTIMA revisao realizada. O vencimento e calculado somando periodicidade_revisao_meses a esta data, ou a data_inicio quando nunca houve revisao.';

-- Retro-preenche a identificacao da organizacao nos PGRs ja criados, para o PDF
-- deles nao sair sem nome nem CNPJ.
UPDATE public.sgsst_pgr p
SET empresa_nome = e.nome,
    empresa_cnpj = e.cnpj
FROM public.empresas e
WHERE e.id = p.empresa_id
  AND p.empresa_nome IS NULL;

-- =====================================================================
-- 5. Historico do PGR (NR-01 1.5.7.3.3 — 20 anos com historico)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pgr_id uuid NOT NULL REFERENCES public.sgsst_pgr(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  versao integer,
  status_anterior text,
  status_novo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_pgr_historico IS
  'Historico de alteracoes do PGR. Era o unico dos dez modulos SGSST sem historico, justamente no documento que a NR-01 manda manter por 20 anos com historico das atualizacoes.';

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_hist_empresa ON public.sgsst_pgr_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_hist_pgr ON public.sgsst_pgr_historico(pgr_id, created_at DESC);

ALTER TABLE public.sgsst_pgr_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico;
CREATE POLICY "Users view own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico;
CREATE POLICY "Users insert own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Sem policy de UPDATE nem de DELETE, de proposito: historico que pode ser
-- editado ou apagado nao serve como historico. As demais tabelas ganham as
-- quatro policies; esta fica com duas.

-- =====================================================================
-- 6. Trigger que registra o historico
-- =====================================================================
-- Em trigger, e nao na aplicacao: alteracao feita por script, pelo painel do
-- Supabase ou por outra tela do sistema tambem precisa aparecer no historico.
-- Registro pela aplicacao so cobre o caminho que a aplicacao conhece.
CREATE OR REPLACE FUNCTION public.fn_sgsst_pgr_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operacao text;
  v_observacao text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sgsst_pgr_historico
      (empresa_id, pgr_id, usuario_id, operacao, versao, status_novo, observacao)
    VALUES
      (NEW.empresa_id, NEW.id, NEW.created_by, 'CRIACAO', NEW.versao, NEW.status,
       'PGR criado');
    RETURN NEW;
  END IF;

  -- UPDATE: so registra quando algo relevante mudou. Gravar linha a cada
  -- `updated_at` tocado encheria o historico de ruido e esconderia a mudanca
  -- que importa.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_operacao := 'MUDANCA_STATUS';
    v_observacao := format('Status alterado de %s para %s', OLD.status, NEW.status);
  ELSIF NEW.versao IS DISTINCT FROM OLD.versao THEN
    v_operacao := 'NOVA_VERSAO';
    v_observacao := format('Versão %s emitida', NEW.versao);
  ELSIF NEW.data_revisao IS DISTINCT FROM OLD.data_revisao THEN
    v_operacao := 'REVISAO';
    v_observacao := format('Data de revisão registrada: %s', NEW.data_revisao);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.sgsst_pgr_historico
    (empresa_id, pgr_id, usuario_id, operacao, versao, status_anterior, status_novo, observacao)
  VALUES
    (NEW.empresa_id, NEW.id, NEW.updated_by, v_operacao, NEW.versao, OLD.status, NEW.status,
     v_observacao);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_pgr_historico ON public.sgsst_pgr;
CREATE TRIGGER trg_sgsst_pgr_historico
  AFTER INSERT OR UPDATE ON public.sgsst_pgr
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_pgr_historico();

-- =====================================================================
-- 7. Semeia o historico dos PGRs que ja existiam
-- =====================================================================
-- Sem isto, um PGR criado antes desta migration apareceria sem nenhum registro,
-- como se nunca tivesse sido criado. Idempotente pelo NOT EXISTS.
INSERT INTO public.sgsst_pgr_historico
  (empresa_id, pgr_id, usuario_id, operacao, versao, status_novo, observacao, created_at)
SELECT p.empresa_id, p.id, p.created_by, 'CRIACAO', p.versao, p.status,
       'Registro retroativo: PGR criado antes do histórico existir', p.created_at
FROM public.sgsst_pgr p
WHERE NOT EXISTS (
  SELECT 1 FROM public.sgsst_pgr_historico h WHERE h.pgr_id = p.id
);
```
