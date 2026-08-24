-- Migration: evidencia fotografica em todo o SGSST
--
-- Nenhuma tela do SGSST tinha anexo de foto. O modulo inteiro — inspecoes,
-- incidentes, nao conformidades, permissoes de trabalho, APR, EPI — registrava
-- desvio em TEXTO. O campo `evidencia` da nao conformidade de inspecao e
-- literalmente uma coluna `text`: dava para escrever "foto 03" e a foto 03 nao
-- existir em lugar nenhum.
--
-- So o modulo de Checklists tinha evidencia com arquivo. Na pratica isso empurrava
-- o time de campo para o checklist mesmo quando o registro certo era uma inspecao
-- ou um incidente — e deixava o documento normativo sem a prova visual que a
-- auditoria pede.
--
-- ---------------------------------------------------------------------------
-- UMA TABELA, E NAO UMA POR ENTIDADE
-- ---------------------------------------------------------------------------
-- A evidencia tem exatamente a mesma forma nas doze entidades: arquivo, onde,
-- quando, por qual meio e quem anexou. Doze tabelas identicas seriam doze
-- migrations, doze hooks e doze componentes para a mesma coisa.
--
-- O custo dessa escolha e real e fica declarado: **nao ha chave estrangeira**. O
-- banco nao pode garantir por FK que `entidade_id` aponta para uma linha que
-- existe, nem apagar as fotos em cascata quando o registro pai morre. Tres
-- mitigacoes, nesta ordem:
--
--   1. CHECK na lista de entidades — entidade escrita errada nao entra.
--   2. Trigger que confere, na tabela correta, se a linha existe E pertence a
--      mesma empresa. E a checagem que a FK faria, feita a mao.
--   3. Trigger de limpeza em cada tabela pai, apagando as evidencias no DELETE.
--      Sem ele a foto sobreviveria ao registro e ficaria orfa para sempre.
--
-- A alternativa — uma coluna de arquivo em cada tabela — foi descartada por nao
-- suportar mais de uma foto, que e o caso normal: um desvio rende a foto de longe,
-- a de perto e a do detalhe.

-- =====================================================================
-- 1. Tabela
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,

  -- A entidade a que a foto pertence. Sem FK: ver o bloco acima.
  entidade text NOT NULL CHECK (entidade IN (
    'INSPECAO',
    'INSPECAO_NC',
    'NAO_CONFORMIDADE',
    'NC_ACAO',
    'INCIDENTE',
    'PT',
    'PT_MEDICAO',
    'APR',
    'APR_ETAPA',
    'EPI_ENTREGA',
    'EPI_DEVOLUCAO',
    'EPI_MANUTENCAO'
  )),
  entidade_id uuid NOT NULL,

  r2_key text NOT NULL,
  r2_url text NOT NULL,
  nome_arquivo text,
  tipo_mime text,
  tamanho bigint,
  -- Legenda. Foto sem legenda obriga quem confere a adivinhar o que esta vendo.
  descricao text,

  -- Geolocalizacao do INSTANTE DA FOTO, no mesmo padrao do checklist. Coordenada
  -- da abertura do registro responde onde a pessoa estava ao abrir, nao onde a
  -- foto foi tirada.
  latitude numeric,
  longitude numeric,
  precisao_metros numeric,
  capturada_em timestamptz,
  origem_captura text CHECK (origem_captura IS NULL OR origem_captura IN ('CAMERA', 'ARQUIVO')),
  motivo_sem_geo text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_evidencias IS
  'Evidencia fotografica de todo o SGSST. Tabela unica porque a forma e identica nas doze entidades; a integridade referencial e feita por trigger, ja que nao ha FK possivel com alvo polimorfico.';

COMMENT ON COLUMN public.sgsst_evidencias.entidade IS
  'Que tipo de registro a foto documenta. O CHECK impede entidade escrita errada; o trigger confere se a linha existe na tabela correta.';

COMMENT ON COLUMN public.sgsst_evidencias.origem_captura IS
  'CAMERA: tirada na hora, com lugar e horario daquele instante. ARQUIVO: escolhida da galeria, pode ser de outro dia e outro lugar.';

COMMENT ON COLUMN public.sgsst_evidencias.motivo_sem_geo IS
  'Por que nao houve coordenada: permissao negada, sinal indisponivel, tempo esgotado. Sem o motivo, quem confere nao sabe o peso da ausencia.';

CREATE INDEX IF NOT EXISTS idx_sgsst_evid_entidade
  ON public.sgsst_evidencias(entidade, entidade_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_evid_empresa_data
  ON public.sgsst_evidencias(empresa_id, created_at DESC);

-- "Quais evidencias sairam sem localizacao" e a consulta de auditoria.
CREATE INDEX IF NOT EXISTS idx_sgsst_evid_sem_geo
  ON public.sgsst_evidencias(empresa_id)
  WHERE latitude IS NULL;

-- =====================================================================
-- 2. RLS
-- =====================================================================
ALTER TABLE public.sgsst_evidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_evidencias" ON public.sgsst_evidencias;
CREATE POLICY "Users view own empresa sgsst_evidencias" ON public.sgsst_evidencias
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_evidencias" ON public.sgsst_evidencias;
CREATE POLICY "Users insert own empresa sgsst_evidencias" ON public.sgsst_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_evidencias" ON public.sgsst_evidencias;
CREATE POLICY "Users update own empresa sgsst_evidencias" ON public.sgsst_evidencias
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_evidencias" ON public.sgsst_evidencias;
CREATE POLICY "Users delete own empresa sgsst_evidencias" ON public.sgsst_evidencias
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_evidencias ON public.sgsst_evidencias;
CREATE TRIGGER audit_sgsst_evidencias
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_evidencias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- =====================================================================
-- 3. A integridade que a chave estrangeira faria
-- =====================================================================
-- Mapeia a entidade para a tabela e confere existencia e empresa. Sem isto, um
-- `entidade_id` digitado errado criaria uma foto orfa que aparece em relatorio
-- nenhum e ocupa espaco para sempre — ou, pior, a foto de uma empresa apontando
-- para o registro de outra.
CREATE OR REPLACE FUNCTION public.check_sgsst_evidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tabela text;
  v_existe boolean;
BEGIN
  v_tabela := CASE NEW.entidade
    WHEN 'INSPECAO'         THEN 'sgsst_inspecoes'
    WHEN 'INSPECAO_NC'      THEN 'sgsst_inspecoes_nao_conformidades'
    WHEN 'NAO_CONFORMIDADE' THEN 'sgsst_nao_conformidades'
    WHEN 'NC_ACAO'          THEN 'sgsst_nao_conformidades_acoes'
    WHEN 'INCIDENTE'        THEN 'sgsst_incidentes'
    WHEN 'PT'               THEN 'sgsst_pt'
    WHEN 'PT_MEDICAO'       THEN 'sgsst_pt_medicoes_atmosfera'
    WHEN 'APR'              THEN 'sgsst_apr'
    WHEN 'APR_ETAPA'        THEN 'sgsst_apr_etapas'
    WHEN 'EPI_ENTREGA'      THEN 'sgsst_epi_entregas'
    WHEN 'EPI_DEVOLUCAO'    THEN 'sgsst_epi_devolucoes'
    WHEN 'EPI_MANUTENCAO'   THEN 'sgsst_epi_manutencoes'
  END;

  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Entidade % não tem tabela mapeada. Ajuste check_sgsst_evidencia ao incluir uma entidade nova.', NEW.entidade;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1 AND empresa_id = $2)',
    v_tabela
  ) INTO v_existe USING NEW.entidade_id, NEW.empresa_id;

  IF NOT v_existe THEN
    RAISE EXCEPTION 'O registro % informado não existe em %, ou pertence a outra empresa.',
      NEW.entidade_id, v_tabela;
  END IF;

  -- As mesmas regras de coerência da geolocalização por foto do checklist.
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

DROP TRIGGER IF EXISTS trg_sgsst_evidencia_valida ON public.sgsst_evidencias;
CREATE TRIGGER trg_sgsst_evidencia_valida
  BEFORE INSERT OR UPDATE ON public.sgsst_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_evidencia();

-- =====================================================================
-- 4. Limpeza no lugar do ON DELETE CASCADE
-- =====================================================================
-- Uma funcao generica, parametrizada pelo nome da entidade no proprio gatilho.
-- Sem isto a foto sobreviveria ao registro apagado e ficaria orfa para sempre —
-- invisivel em qualquer tela e ocupando espaco no R2.
CREATE OR REPLACE FUNCTION public.fn_sgsst_evidencia_limpeza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sgsst_evidencias
   WHERE entidade = TG_ARGV[0]
     AND entidade_id = OLD.id;

  RETURN OLD;
END;
$$;

DO $$
DECLARE
  v_par text[];
  v_pares text[][] := ARRAY[
    ARRAY['sgsst_inspecoes', 'INSPECAO'],
    ARRAY['sgsst_inspecoes_nao_conformidades', 'INSPECAO_NC'],
    ARRAY['sgsst_nao_conformidades', 'NAO_CONFORMIDADE'],
    ARRAY['sgsst_nao_conformidades_acoes', 'NC_ACAO'],
    ARRAY['sgsst_incidentes', 'INCIDENTE'],
    ARRAY['sgsst_pt', 'PT'],
    ARRAY['sgsst_pt_medicoes_atmosfera', 'PT_MEDICAO'],
    ARRAY['sgsst_apr', 'APR'],
    ARRAY['sgsst_apr_etapas', 'APR_ETAPA'],
    ARRAY['sgsst_epi_entregas', 'EPI_ENTREGA'],
    ARRAY['sgsst_epi_devolucoes', 'EPI_DEVOLUCAO'],
    ARRAY['sgsst_epi_manutencoes', 'EPI_MANUTENCAO']
  ];
BEGIN
  FOREACH v_par SLICE 1 IN ARRAY v_pares LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_evid_limpeza_%1$s ON public.%1$I', v_par[1]
    );
    EXECUTE format(
      'CREATE TRIGGER trg_evid_limpeza_%1$s
         AFTER DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_evidencia_limpeza(%2$L)',
      v_par[1], v_par[2]
    );
  END LOOP;
END $$;

-- =====================================================================
-- 5. O campo de texto que existia continua, com o papel corrigido
-- =====================================================================
-- `evidencia` da nao conformidade de inspecao era o unico lugar para registrar a
-- prova, e e texto. Nao e removido — ha registros usando —, mas deixa de ser "a
-- evidencia" e passa a ser a descricao dela.
COMMENT ON COLUMN public.sgsst_inspecoes_nao_conformidades.evidencia IS
  'Descricao textual da evidencia. As fotos ficam em sgsst_evidencias com entidade = INSPECAO_NC. Antes esta coluna era o unico registro possivel da prova.';
