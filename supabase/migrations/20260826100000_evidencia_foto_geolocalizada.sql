-- Migration: geolocalizacao e origem por FOTO, nao por aplicacao
--
-- O sistema guardava coordenadas em `checklist_geolocalizacoes` nos momentos
-- "inicio" e "conclusao" da aplicacao. Isso responde onde a pessoa estava quando
-- abriu e quando fechou o checklist — e nao responde a pergunta que a auditoria
-- faz: ONDE ESTA FOTO FOI TIRADA. Entre abrir e fechar um checklist de trinta
-- itens passam horas e quilometros.
--
-- Duas informacoes por evidencia, e as duas mudam o peso dela:
--
--   1. COORDENADA E PRECISAO no instante da captura. Precisao importa junto: um
--      ponto com 800 m de raio localiza o bairro, nao o andaime, e apresentar um
--      como o outro e pior que dizer que nao ha ponto.
--
--   2. ORIGEM. Foto tirada na camera tem o lugar e o horario daquele instante.
--      Arquivo escolhido da galeria pode ser de qualquer dia e de qualquer lugar —
--      inclusive por motivo legitimo (foto de laudo, print de documento), mas a
--      folha precisa dizer qual dos dois e.
--
-- Nenhuma das colunas e obrigatoria: foto sem coordenada continua sendo aceita e
-- sai MARCADA como sem localizacao. Bloquear a foto por falta de GPS deixaria o
-- inspetor sem registrar o desvio — o oposto do objetivo.

ALTER TABLE public.checklist_evidencias
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS precisao_metros numeric,
  ADD COLUMN IF NOT EXISTS capturada_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_captura text
    CHECK (origem_captura IS NULL OR origem_captura IN ('CAMERA', 'ARQUIVO')),
  -- Quando nao houve coordenada, o motivo. "Sem localizacao" sem motivo deixa quem
  -- confere sem saber se foi permissao negada, sinal ausente ou desligado de
  -- proposito — e as tres coisas pesam diferente.
  ADD COLUMN IF NOT EXISTS motivo_sem_geo text;

COMMENT ON COLUMN public.checklist_evidencias.latitude IS
  'Latitude no instante da captura da foto — nao da abertura da aplicacao.';

COMMENT ON COLUMN public.checklist_evidencias.precisao_metros IS
  'Raio de incerteza informado pelo dispositivo. Acima de 100 m a coordenada localiza a regiao, nao o ponto de trabalho, e o selo diz isso.';

COMMENT ON COLUMN public.checklist_evidencias.origem_captura IS
  'CAMERA: capturada na hora, com lugar e horario daquele instante. ARQUIVO: escolhida da galeria, pode ser de outro dia e outro lugar.';

COMMENT ON COLUMN public.checklist_evidencias.motivo_sem_geo IS
  'Por que nao houve coordenada: permissao negada, sinal indisponivel, tempo esgotado. Sem o motivo, quem confere nao sabe o peso da ausencia.';

-- =====================================================================
-- Coerencia entre a coordenada e o motivo da ausencia
-- =====================================================================
-- Sem esta trava caberia gravar coordenada E motivo de ausencia na mesma linha, e
-- o selo impresso citaria os dois — afirmando e negando a mesma coisa.
CREATE OR REPLACE FUNCTION public.check_checklist_evidencia_geo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'Coordenada incompleta: latitude e longitude precisam vir juntas.';
  END IF;

  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'Latitude fora da faixa válida: %.', NEW.latitude;
  END IF;

  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'Longitude fora da faixa válida: %.', NEW.longitude;
  END IF;

  IF NEW.precisao_metros IS NOT NULL AND NEW.precisao_metros < 0 THEN
    RAISE EXCEPTION 'A precisão não pode ser negativa.';
  END IF;

  IF NEW.latitude IS NOT NULL AND NEW.motivo_sem_geo IS NOT NULL THEN
    RAISE EXCEPTION 'A evidência tem coordenada e também motivo de ausência de coordenada — os dois se contradizem.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_evidencia_geo ON public.checklist_evidencias;
CREATE TRIGGER trg_checklist_evidencia_geo
  BEFORE INSERT OR UPDATE ON public.checklist_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.check_checklist_evidencia_geo();

-- =====================================================================
-- Indices
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_checklist_evid_aplicacao
  ON public.checklist_evidencias(aplicacao_id);

CREATE INDEX IF NOT EXISTS idx_checklist_evid_resposta
  ON public.checklist_evidencias(resposta_id)
  WHERE resposta_id IS NOT NULL;

-- "Quais evidencias sairam sem localizacao" e a consulta de auditoria.
CREATE INDEX IF NOT EXISTS idx_checklist_evid_sem_geo
  ON public.checklist_evidencias(empresa_id)
  WHERE latitude IS NULL;
