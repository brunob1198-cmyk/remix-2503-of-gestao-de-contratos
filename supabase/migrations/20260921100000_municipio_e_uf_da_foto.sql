-- ============================================================================
-- Município e UF de onde a foto foi tirada
-- ============================================================================
--
-- As fotos já guardavam a coordenada. Coordenada não se lê: ninguém abre uma
-- folha de inspeção e reconhece `-14.524700, -49.140800` como Uruaçu. Quem
-- confere o documento — fiscal, cliente, o gestor meses depois — precisa saber em
-- que cidade aquilo foi registrado sem abrir um mapa.
--
-- O NOME É APURADO NA HORA DA FOTO, E NÃO NA HORA DE EXIBIR
--
-- Por isso são colunas, e não um cálculo na tela. Três razões:
--
--   1. Uma lista com cinquenta fotos faria cinquenta consultas externas a cada
--      abertura de tela.
--   2. O PDF é montado sem rede garantida, e sairia sem os nomes.
--   3. O documento é evidência: o que ele afirma tem de ser o que foi apurado
--      naquele instante, e não o que um serviço externo responder no ano que vem.
--
-- NULAS DE PROPÓSITO
--
-- Toda foto anterior a esta migration fica sem município, e assim deve ficar.
-- Preencher depois, a partir da coordenada guardada, produziria um nome apurado
-- hoje para uma foto de um ano atrás — e o documento passaria a afirmar como
-- apurado no ato algo que não foi. Foto velha continua saindo só com a
-- coordenada, que é o que se sabe dela.
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas, nas quatro tabelas que guardam foto de campo
-- ---------------------------------------------------------------------------

ALTER TABLE public.diario_fotos
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text;

ALTER TABLE public.diario_campo_fotos
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text;

ALTER TABLE public.checklist_evidencias
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text;

ALTER TABLE public.sgsst_evidencias
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text;

-- ---------------------------------------------------------------------------
-- 2. A UF é sigla de duas letras, ou nada
-- ---------------------------------------------------------------------------
-- O serviço externo devolve o código ISO (`BR-GO`), e o aplicativo recorta a
-- sigla. A regra existe aqui porque o selo do documento imprime esta coluna
-- direto: um `Goiás` gravado por engano sairia como "Uruaçu-Goiás", e um
-- `BR-GO` sairia como "Uruaçu-BR-GO".
--
-- Fora do Brasil a coluna fica nula e o selo mostra só o município — inventar
-- uma UF para uma coordenada estrangeira seria afirmar o que não existe.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'diario_fotos', 'diario_campo_fotos', 'checklist_evidencias', 'sgsst_evidencias'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_uf_check'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (uf IS NULL OR uf ~ ''^[A-Z]{2}$'')',
        t, t || '_uf_check'
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Município sem coordenada não se sustenta
-- ---------------------------------------------------------------------------
-- O nome é derivado da coordenada. Uma linha com município e sem latitude estaria
-- afirmando um lugar que nada apurou — e é justamente o tipo de afirmação que
-- este conjunto de colunas existe para evitar.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'diario_fotos', 'diario_campo_fotos', 'checklist_evidencias', 'sgsst_evidencias'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_municipio_exige_coordenada'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (municipio IS NULL OR latitude IS NOT NULL)',
        t, t || '_municipio_exige_coordenada'
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Documentação
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.diario_fotos.municipio IS
  'Município apurado a partir da coordenada no instante da foto. Nulo em foto anterior a esta migration e quando o serviço nao respondeu.';
COMMENT ON COLUMN public.diario_fotos.uf IS
  'Sigla de duas letras. Nula fora do Brasil e quando o municipio nao foi apurado.';

COMMENT ON COLUMN public.diario_campo_fotos.municipio IS
  'Município apurado a partir da coordenada no instante da foto.';
COMMENT ON COLUMN public.diario_campo_fotos.uf IS
  'Sigla de duas letras. Nula fora do Brasil.';

COMMENT ON COLUMN public.checklist_evidencias.municipio IS
  'Município apurado a partir da coordenada no instante da foto.';
COMMENT ON COLUMN public.checklist_evidencias.uf IS
  'Sigla de duas letras. Nula fora do Brasil.';

COMMENT ON COLUMN public.sgsst_evidencias.municipio IS
  'Município apurado a partir da coordenada no instante da foto.';
COMMENT ON COLUMN public.sgsst_evidencias.uf IS
  'Sigla de duas letras. Nula fora do Brasil.';
