-- ============================================================================
-- Geolocalização das fotos do Diário de Obra e do Diário de Campo
-- ============================================================================
--
-- O Diário de Obra é o documento que o cliente lê para saber o que aconteceu na
-- obra naquele dia, e as fotos são a maior parte do que ele prova. Elas existiam
-- desde sempre — com grupo, ordem e legenda — e não guardavam NEM ONDE NEM QUANDO
-- foram tiradas.
--
-- Sem isso a foto sustenta menos do que parece sustentar:
--
--   * "Concretagem do bloco B3" com a foto de outro bloco não tem como ser
--     contestada, porque não há em que se apoiar para contestar.
--   * A mesma foto pode ser reaproveitada em outro dia sem que nada indique.
--   * A medição paga em cima do diário, e a glosa costuma vir de foto que o
--     fiscal não reconhece como sendo daquela frente de serviço.
--
-- O Diário de Campo já tinha o botão de câmera (o único do projeto que tinha) e
-- também não guardava coordenada. As duas tabelas recebem as mesmas colunas, com o
-- mesmo trigger, porque a pergunta é a mesma nas duas.
--
-- COLUNAS NOVAS, E NÃO TABELA SEPARADA: a foto do diário já é uma linha própria em
-- `diario_fotos`. Uma tabela de metadados ao lado obrigaria a um join em toda
-- listagem — e o Diário lista fotos em quase toda tela.
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------------------------
-- Nulas de propósito. Todo o histórico do projeto foi gravado antes disto existir,
-- e preencher com um valor inventado seria pior que a ausência: a folha passaria a
-- afirmar uma localização que ninguém registrou.

ALTER TABLE public.diario_fotos
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS precisao_metros numeric(8, 2),
  ADD COLUMN IF NOT EXISTS capturada_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_captura text,
  ADD COLUMN IF NOT EXISTS motivo_sem_geo text;

ALTER TABLE public.diario_campo_fotos
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS precisao_metros numeric(8, 2),
  ADD COLUMN IF NOT EXISTS capturada_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_captura text,
  ADD COLUMN IF NOT EXISTS motivo_sem_geo text;

-- ---------------------------------------------------------------------------
-- 2. Origem da captura
-- ---------------------------------------------------------------------------
-- CAMERA e ARQUIVO pesam diferente na conferência: foto tirada na hora tem a
-- coordenada do lugar onde ela foi tirada; arquivo escolhido da galeria tem a
-- coordenada de onde estava quem o enviou, que pode ser o escritório. A tela marca
-- a segunda com alerta justamente por isso — e não dá para marcar sem saber qual é.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diario_fotos_origem_captura_check'
  ) THEN
    ALTER TABLE public.diario_fotos
      ADD CONSTRAINT diario_fotos_origem_captura_check
      CHECK (origem_captura IS NULL OR origem_captura IN ('CAMERA', 'ARQUIVO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diario_campo_fotos_origem_captura_check'
  ) THEN
    ALTER TABLE public.diario_campo_fotos
      ADD CONSTRAINT diario_campo_fotos_origem_captura_check
      CHECK (origem_captura IS NULL OR origem_captura IN ('CAMERA', 'ARQUIVO'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Coerência da coordenada
-- ---------------------------------------------------------------------------
-- As mesmas quatro regras do trigger das evidências do SGSST, pelo mesmo motivo: o
-- selo impresso na folha é montado destas colunas, e coordenada incoerente produz
-- selo que afirma o que os dados não sustentam.
--
-- A regra que menos parece necessária é a última, e é a que mais importa: com
-- coordenada E motivo de ausência na mesma linha, o selo diria ao mesmo tempo onde
-- a foto foi tirada e que não se sabe onde ela foi tirada.

CREATE OR REPLACE FUNCTION public.check_diario_foto_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Meia coordenada não localiza nada.
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'A latitude e longitude precisam vir juntas: uma sozinha não localiza a foto.';
  END IF;

  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'Latitude fora da faixa válida (-90 a 90): %', NEW.latitude;
  END IF;

  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'Longitude fora da faixa válida (-180 a 180): %', NEW.longitude;
  END IF;

  -- Precisão negativa viraria "±-30 m" no selo.
  IF NEW.precisao_metros IS NOT NULL AND NEW.precisao_metros < 0 THEN
    RAISE EXCEPTION 'A precisão não pode ser negativa: %', NEW.precisao_metros;
  END IF;

  IF NEW.latitude IS NOT NULL AND NEW.motivo_sem_geo IS NOT NULL THEN
    RAISE EXCEPTION 'A foto tem coordenada e motivo de ausência de coordenada — os dois se contradizem.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_diario_foto_geo() IS
  'Coerência da geolocalização das fotos do diário. O selo impresso no relatório é montado destas colunas.';

DROP TRIGGER IF EXISTS trg_check_diario_foto_geo ON public.diario_fotos;
CREATE TRIGGER trg_check_diario_foto_geo
  BEFORE INSERT OR UPDATE ON public.diario_fotos
  FOR EACH ROW EXECUTE FUNCTION public.check_diario_foto_geo();

DROP TRIGGER IF EXISTS trg_check_diario_campo_foto_geo ON public.diario_campo_fotos;
CREATE TRIGGER trg_check_diario_campo_foto_geo
  BEFORE INSERT OR UPDATE ON public.diario_campo_fotos
  FOR EACH ROW EXECUTE FUNCTION public.check_diario_foto_geo();

-- ---------------------------------------------------------------------------
-- 4. Documentação das colunas
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.diario_fotos.latitude IS
  'Latitude do instante da foto. Nula em foto anterior a esta migration e em captura sem GPS — ver motivo_sem_geo.';
COMMENT ON COLUMN public.diario_fotos.precisao_metros IS
  'Raio de incerteza informado pelo dispositivo. Acima de 100 m a tela marca a coordenada como ruim.';
COMMENT ON COLUMN public.diario_fotos.capturada_em IS
  'Momento da captura, que não é o momento do envio: foto tirada offline é enviada horas depois.';
COMMENT ON COLUMN public.diario_fotos.origem_captura IS
  'CAMERA = tirada no aparelho naquele instante. ARQUIVO = escolhida da galeria, e a coordenada é de quem enviou, não de onde a foto foi tirada.';
COMMENT ON COLUMN public.diario_fotos.motivo_sem_geo IS
  'Por que não há coordenada: permissão negada pesa diferente de sinal indisponível. Excludente com latitude/longitude.';

COMMENT ON COLUMN public.diario_campo_fotos.latitude IS
  'Latitude do instante da foto. Nula em foto anterior a esta migration e em captura sem GPS — ver motivo_sem_geo.';
COMMENT ON COLUMN public.diario_campo_fotos.origem_captura IS
  'CAMERA = tirada no aparelho naquele instante. ARQUIVO = escolhida da galeria.';
COMMENT ON COLUMN public.diario_campo_fotos.motivo_sem_geo IS
  'Por que não há coordenada. Excludente com latitude/longitude.';
