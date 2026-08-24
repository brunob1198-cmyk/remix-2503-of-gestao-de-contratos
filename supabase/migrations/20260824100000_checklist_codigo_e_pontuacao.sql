-- Migration: codigo sequencial e integridade da pontuacao dos checklists
--
-- Dois problemas nesta tela, e os dois nascem do mesmo lugar: numeracao inventada
-- no cliente e regra de pontuacao que existia so na tela.
--
-- 1. CODIGO ALEATORIO DE QUATRO DIGITOS.
--    O modelo saia como `CHK-{1000 + random*9000}` e o plano de acao como
--    `PA-{1000 + random*9000}`. Sao 9.000 valores possiveis e nenhuma restricao de
--    unicidade: pelo paradoxo do aniversario, a chance de colisao passa de 50% por
--    volta do centesimo registro. Dois planos de acao com o mesmo codigo destroem a
--    rastreabilidade justamente do que precisa ser rastreado — e a aplicacao de
--    checklist nem recebia codigo.
--
-- 2. PESO SEM EFEITO.
--    `peso_pontuacao` existia na tabela e o calculo somava 1.0 fixo por item. O
--    peso passa a entrar na conta (no cliente, com teste), e aqui o banco garante
--    que o valor gravado e utilizavel: peso zero ou negativo tiraria o item da
--    conta sem ninguem ter marcado "nao aplicavel".

-- =====================================================================
-- 1. Peso utilizavel
-- =====================================================================
UPDATE public.checklist_itens SET peso_pontuacao = 1
 WHERE peso_pontuacao IS NULL OR peso_pontuacao <= 0;

ALTER TABLE public.checklist_itens
  ALTER COLUMN peso_pontuacao SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_checklist_item_peso_positivo'
  ) THEN
    ALTER TABLE public.checklist_itens
      ADD CONSTRAINT chk_checklist_item_peso_positivo
      CHECK (peso_pontuacao IS NULL OR peso_pontuacao > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.checklist_itens.peso_pontuacao IS
  'Peso do item no indice de conformidade. Item de peso 10 nao conforme derruba o indice dez vezes mais que um de peso 1. Nulo ou ausente conta como 1.';

-- =====================================================================
-- 2. Numeracao sequencial por empresa
-- =====================================================================
-- Gera PREFIXO-AAAA-NNNN contando por empresa e por ano. O `pg_advisory_xact_lock`
-- serializa a geracao dentro da empresa: sem ele, duas aplicacoes simultaneas leem
-- o mesmo MAX e produzem o mesmo numero — a corrida que o codigo aleatorio tentava
-- evitar por sorteio.
CREATE OR REPLACE FUNCTION public.fn_checklist_proximo_codigo(
  p_tabela text,
  p_empresa_id uuid,
  p_prefixo text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano text := to_char(now(), 'YYYY');
  v_proximo integer;
  v_sql text;
BEGIN
  -- Uma trava por (tabela, empresa): empresas diferentes nao esperam uma pela outra.
  PERFORM pg_advisory_xact_lock(hashtext(p_tabela || p_empresa_id::text));

  v_sql := format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, ''^.*-'', ''''), '''')::integer), 0) + 1
       FROM public.%I
      WHERE empresa_id = $1
        AND codigo LIKE $2',
    p_tabela
  );

  EXECUTE v_sql INTO v_proximo USING p_empresa_id, p_prefixo || '-' || v_ano || '-%';

  RETURN format('%s-%s-%s', p_prefixo, v_ano, lpad(v_proximo::text, 4, '0'));
END;
$$;

COMMENT ON FUNCTION public.fn_checklist_proximo_codigo IS
  'Proximo codigo sequencial no formato PREFIXO-AAAA-NNNN, por empresa e por ano. Usa advisory lock para nao repetir sob concorrencia.';

-- =====================================================================
-- 3. Triggers de numeracao
-- =====================================================================
-- Só preenche quando vem vazio: codigo informado a mao continua respeitado.
CREATE OR REPLACE FUNCTION public.fn_checklist_modelo_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_checklist_proximo_codigo(
      'checklist_modelos', NEW.empresa_id, 'CHK'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_modelo_codigo ON public.checklist_modelos;
CREATE TRIGGER trg_checklist_modelo_codigo
  BEFORE INSERT ON public.checklist_modelos
  FOR EACH ROW EXECUTE FUNCTION public.fn_checklist_modelo_codigo();

CREATE OR REPLACE FUNCTION public.fn_checklist_aplicacao_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_checklist_proximo_codigo(
      'checklist_aplicacoes', NEW.empresa_id, 'APL'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_aplicacao_codigo ON public.checklist_aplicacoes;
CREATE TRIGGER trg_checklist_aplicacao_codigo
  BEFORE INSERT ON public.checklist_aplicacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_checklist_aplicacao_codigo();

CREATE OR REPLACE FUNCTION public.fn_checklist_plano_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_checklist_proximo_codigo(
      'checklist_planos_acao', NEW.empresa_id, 'PA'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_plano_codigo ON public.checklist_planos_acao;
CREATE TRIGGER trg_checklist_plano_codigo
  BEFORE INSERT ON public.checklist_planos_acao
  FOR EACH ROW EXECUTE FUNCTION public.fn_checklist_plano_codigo();

-- =====================================================================
-- 4. Unicidade
-- =====================================================================
-- Os indices vao ao fim, depois de a numeracao estar em vigor: criar antes faria a
-- criacao falhar se ja existirem duplicatas dos codigos aleatorios.
--
-- Duplicata anterior a esta migration NAO e apagada nem renumerada — reescrever
-- codigo de registro que alguem ja imprimiu ou citou num plano de acao seria pior
-- que a duplicata. O indice e criado como NOT VALID em espirito: se houver
-- colisao herdada, a criacao falha e o aviso abaixo diz o que fazer.
DO $$
DECLARE
  v_dup integer;
BEGIN
  SELECT count(*) INTO v_dup FROM (
    SELECT empresa_id, codigo FROM public.checklist_planos_acao
     WHERE codigo IS NOT NULL AND codigo <> ''
     GROUP BY empresa_id, codigo HAVING count(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE WARNING 'Existem % codigo(s) de plano de acao duplicados, herdados da numeracao aleatoria. O indice unico NAO foi criado. Renumere manualmente os duplicados e rode: CREATE UNIQUE INDEX uq_checklist_plano_codigo ON public.checklist_planos_acao(empresa_id, codigo) WHERE codigo IS NOT NULL AND codigo <> '''';', v_dup;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_plano_codigo
      ON public.checklist_planos_acao(empresa_id, codigo)
      WHERE codigo IS NOT NULL AND codigo <> '';
  END IF;
END $$;

DO $$
DECLARE
  v_dup integer;
BEGIN
  SELECT count(*) INTO v_dup FROM (
    SELECT empresa_id, codigo FROM public.checklist_modelos
     WHERE codigo IS NOT NULL AND codigo <> ''
     GROUP BY empresa_id, codigo HAVING count(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE WARNING 'Existem % codigo(s) de modelo duplicados. O indice unico NAO foi criado.', v_dup;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_modelo_codigo
      ON public.checklist_modelos(empresa_id, codigo)
      WHERE codigo IS NOT NULL AND codigo <> '';
  END IF;
END $$;

DO $$
DECLARE
  v_dup integer;
BEGIN
  SELECT count(*) INTO v_dup FROM (
    SELECT empresa_id, codigo FROM public.checklist_aplicacoes
     WHERE codigo IS NOT NULL AND codigo <> ''
     GROUP BY empresa_id, codigo HAVING count(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE WARNING 'Existem % codigo(s) de aplicacao duplicados. O indice unico NAO foi criado.', v_dup;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_aplicacao_codigo
      ON public.checklist_aplicacoes(empresa_id, codigo)
      WHERE codigo IS NOT NULL AND codigo <> '';
  END IF;
END $$;

-- =====================================================================
-- 5. Escalacao do plano de acao para nao conformidade do SGSST
-- =====================================================================
-- O botao "Converter em Nao Conformidade" nunca funcionou: o insert mandava
-- `origem_tipo = 'CHECKLIST'`, valor que o CHECK da tabela nao aceitava, alem de
-- usar tres nomes de coluna inexistentes. O lado do cliente foi corrigido; aqui o
-- banco passa a aceitar a origem.
ALTER TABLE public.sgsst_nao_conformidades
  DROP CONSTRAINT IF EXISTS sgsst_nao_conformidades_origem_tipo_check;

ALTER TABLE public.sgsst_nao_conformidades
  ADD CONSTRAINT sgsst_nao_conformidades_origem_tipo_check
  CHECK (origem_tipo IN ('INSPECAO', 'INCIDENTE', 'PGR', 'APR', 'PT', 'CHECKLIST', 'MANUAL'));

COMMENT ON COLUMN public.sgsst_nao_conformidades.origem_tipo IS
  'De onde veio a nao conformidade. CHECKLIST cobre o plano de acao 5W2H escalado da tela de Checklists Inteligentes.';

-- A NC tambem passa a receber numeracao sequencial quando nao informada: a tabela
-- ja tinha indice unico por (empresa, codigo), e o codigo aleatorio do cliente
-- colidia com ele.
CREATE OR REPLACE FUNCTION public.fn_sgsst_nc_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
    NEW.codigo := public.fn_checklist_proximo_codigo(
      'sgsst_nao_conformidades', NEW.empresa_id, 'NC'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_nc_codigo ON public.sgsst_nao_conformidades;
CREATE TRIGGER trg_sgsst_nc_codigo
  BEFORE INSERT ON public.sgsst_nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_nc_codigo();

-- =====================================================================
-- 6. Indices das consultas paginadas
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_checklist_apl_empresa_data
  ON public.checklist_aplicacoes(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_pa_empresa_data
  ON public.checklist_planos_acao(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_mod_empresa_data
  ON public.checklist_modelos(empresa_id, created_at DESC);
