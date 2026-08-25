-- ============================================================================
-- ASO conforme a NR-07: grade de perigos, aptidão opcional e aptidão por atividade
-- ============================================================================
--
-- Três defeitos do ASO, sendo o primeiro o mais grave que este módulo teve.
--
-- 1. A CONCLUSÃO DE APTIDÃO ERA PREENCHIDA PELO SISTEMA
--
--    A coluna nascia `NOT NULL DEFAULT 'APTO'`. Um ASO criado sem ninguém tocar no
--    campo já saía dizendo que o trabalhador está APTO — e o PDF imprimia isso em
--    corpo grande e verde, com a mesma aparência de uma conclusão assinada por
--    médico. É a única afirmação do documento que só um médico pode fazer, e era a
--    que o sistema fazia por omissão.
--
--    Agora a conclusão é OPCIONAL. Ausente, o PDF sai com as caixas de marcação
--    vazias, para o examinador preencher e assinar.
--
--    Os registros que já existem NÃO são alterados. Não há como distinguir o
--    'APTO' que um médico concluiu do 'APTO' que o default escreveu, e reescrever
--    dado clínico retroativamente seria pior que conviver com a ambiguidade. O que
--    esta migration garante é que nenhum ASO NOVO nasça com conclusão que ninguém
--    fez.
--
-- 2. OS PERIGOS ERAM TEXTO LIVRE
--
--    Toda ficha de ASO em uso traz os agentes de risco em lista de marcação,
--    agrupada por categoria. Texto livre obriga a redigir de novo, a cada ASO, o
--    que já é vocabulário fechado — e não se conta nem se confere: "Ruído",
--    "ruido excessivo" e "exposição a ruído" são o mesmo agente e três strings.
--
--    A descrição em texto continua, agora como complemento.
--
-- 3. NÃO HAVIA APTIDÃO POR ATIVIDADE
--
--    A ficha avalia à parte altura, espaço confinado e operação de máquinas. Sem
--    isso, a PT de altura não tem o que consultar para saber se o trabalhador foi
--    liberado para subir.
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A conclusão de aptidão passa a ser opcional
-- ---------------------------------------------------------------------------
-- Some o DEFAULT e some o NOT NULL. O CHECK fica: em Postgres, CHECK sobre NULL
-- resulta em NULL, que a constraint aceita — então a lista de valores válidos
-- continua valendo para quem preenche.

ALTER TABLE public.sgsst_asos ALTER COLUMN aptidao DROP DEFAULT;
ALTER TABLE public.sgsst_asos ALTER COLUMN aptidao DROP NOT NULL;

COMMENT ON COLUMN public.sgsst_asos.aptidao IS
  'Conclusão médica de aptidão para a função. NULA = o médico ainda não concluiu, e o PDF sai com as caixas em branco para preenchimento e assinatura. Nunca preencher por default: é a única afirmação do ASO que só um médico pode fazer.';

-- ---------------------------------------------------------------------------
-- 2. Aptidão por atividade específica
-- ---------------------------------------------------------------------------
-- Três estados, e a distinção entre dois deles é o que evita erro dos dois lados:
--
--   APTO          -> liberado para aquela atividade
--   INAPTO        -> avaliado e NÃO liberado
--   NAO_SE_APLICA -> avaliado, e a atividade não faz parte do trabalho dele
--   NULL          -> ninguém avaliou
--
-- "Não se aplica" não é "inapto": quem nunca sobe em andaime não é inapto para
-- altura. Confundir os dois barraria gente de serviço que ela pode fazer; o
-- oposto liberaria quem nunca foi avaliado.

DO $$
DECLARE
  v_coluna text;
BEGIN
  FOREACH v_coluna IN ARRAY ARRAY['apto_altura', 'apto_espaco_confinado', 'apto_maquinas']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.sgsst_asos ADD COLUMN IF NOT EXISTS %I text', v_coluna
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = format('sgsst_asos_%s_check', v_coluna)
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.sgsst_asos ADD CONSTRAINT %I CHECK (%I IS NULL OR %I IN (''APTO'', ''INAPTO'', ''NAO_SE_APLICA''))',
        format('sgsst_asos_%s_check', v_coluna), v_coluna, v_coluna
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.sgsst_asos.apto_altura IS
  'Aptidão para trabalho em altura (NR-35). APTO / INAPTO / NAO_SE_APLICA; NULL = não avaliado. É esta coluna que a PT de altura deve consultar — nem NULL nem NAO_SE_APLICA autorizam.';
COMMENT ON COLUMN public.sgsst_asos.apto_espaco_confinado IS
  'Aptidão para espaço confinado (NR-33). APTO / INAPTO / NAO_SE_APLICA; NULL = não avaliado.';
COMMENT ON COLUMN public.sgsst_asos.apto_maquinas IS
  'Aptidão para operar máquinas, equipamentos ou veículos. APTO / INAPTO / NAO_SE_APLICA; NULL = não avaliado.';

-- ---------------------------------------------------------------------------
-- 3. Grade de perigos e fatores de risco
-- ---------------------------------------------------------------------------
-- Array de códigos do catálogo em `src/utils/sgsstRiscosAso.ts`. Array e não
-- tabela de ligação porque não há atributo nenhum por item: a marcação é a
-- informação inteira, e uma tabela custaria um join em toda leitura do ASO.

ALTER TABLE public.sgsst_asos
  ADD COLUMN IF NOT EXISTS riscos_marcados text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sem_risco_especifico boolean NOT NULL DEFAULT false;

-- A NR-07 7.5.15.1 "b" pede os perigos "ou a sua inexistência". Inexistência é uma
-- AFIRMAÇÃO que alguém faz, não o silêncio de um campo em branco — por isso ela é
-- uma coluna própria. Tratar lista vazia como "não há risco" transformaria todo
-- ASO não preenchido num atestado de atividade sem perigo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sgsst_asos_riscos_coerentes_check'
  ) THEN
    ALTER TABLE public.sgsst_asos
      ADD CONSTRAINT sgsst_asos_riscos_coerentes_check
      CHECK (NOT (sem_risco_especifico AND array_length(riscos_marcados, 1) > 0));
  END IF;
END $$;

COMMENT ON COLUMN public.sgsst_asos.riscos_marcados IS
  'Códigos dos agentes de risco marcados, do catálogo em src/utils/sgsstRiscosAso.ts. Vazio significa NÃO PREENCHIDO, e não ausência de risco — para ausência existe sem_risco_especifico.';
COMMENT ON COLUMN public.sgsst_asos.sem_risco_especifico IS
  'Afirmação expressa de que a atividade não tem risco específico (NR-07 7.5.15.1 "b" — "ou a sua inexistência"). Excludente com riscos_marcados.';
COMMENT ON COLUMN public.sgsst_asos.descricao_riscos IS
  'Descrição dos perigos em texto. Deixa de ser a única forma de registro e passa a COMPLEMENTAR a grade: é onde entra o que a lista não cobre e a classificação vinda do inventário do PGR.';

-- ---------------------------------------------------------------------------
-- 4. Campos de identificação que a ficha pede e não existiam
-- ---------------------------------------------------------------------------

ALTER TABLE public.sgsst_asos
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS nova_funcao text,
  ADD COLUMN IF NOT EXISTS data_exame_clinico date;

COMMENT ON COLUMN public.sgsst_asos.unidade IS
  'Unidade a que o ASO se refere (matriz, filial, obra). Campo do cabeçalho da ficha.';
COMMENT ON COLUMN public.sgsst_asos.nova_funcao IS
  'Função para a qual o trabalhador está sendo avaliado, quando o exame é de mudança de função. Sem isto, o ASO de mudança não diz para QUAL função ele está apto.';
COMMENT ON COLUMN public.sgsst_asos.data_exame_clinico IS
  'Data do exame clínico-ocupacional. Distinta da data de emissão do ASO e das datas dos exames complementares — a NR-07 7.5.15.1 "c" pede a indicação dos exames com as respectivas datas.';

-- ---------------------------------------------------------------------------
-- 5. Ordem do exame complementar
-- ---------------------------------------------------------------------------
-- REFERENCIAL é o exame que estabelece a linha de base do trabalhador;
-- SEQUENCIAL é o de acompanhamento, comparado contra o referencial. A ficha traz
-- essa coluna porque um resultado alterado só é interpretável contra a referência.

ALTER TABLE public.sgsst_exames
  ADD COLUMN IF NOT EXISTS ordem_exame text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sgsst_exames_ordem_exame_check'
  ) THEN
    ALTER TABLE public.sgsst_exames
      ADD CONSTRAINT sgsst_exames_ordem_exame_check
      CHECK (ordem_exame IS NULL OR ordem_exame IN ('REFERENCIAL', 'SEQUENCIAL'));
  END IF;
END $$;

COMMENT ON COLUMN public.sgsst_exames.ordem_exame IS
  'REFERENCIAL = estabelece a linha de base do trabalhador. SEQUENCIAL = acompanhamento, comparado contra o referencial. NULL = não informado.';
