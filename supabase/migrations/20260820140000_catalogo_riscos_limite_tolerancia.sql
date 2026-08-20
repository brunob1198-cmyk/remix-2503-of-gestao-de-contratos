-- Migration: limite de tolerancia no catalogo de riscos (Fase 1 do plano de Seguranca)
--
-- O catalogo tinha o agente e a fonte geradora, mas nao o numero que transforma o
-- risco em decisao tecnica. Sem limite de tolerancia nao se pode dizer se a
-- exposicao medida esta acima ou abaixo do permitido — e e isso que define se o
-- risco e aceitavel.
--
-- E pre-requisito da fase 3: a alinea "dados de monitoramento" do inventario do
-- PGR (NR-01 1.5.7.3.2) so faz sentido se houver limite contra o qual comparar.

ALTER TABLE public.sgsst_riscos_catalogo
  -- Numerico de proposito, para o sistema poder comparar com a medicao. O valor
  -- textual (ex.: "85 dB(A) para 8h") fica na base_legal.
  ADD COLUMN IF NOT EXISTS limite_tolerancia numeric,
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS tecnica_avaliacao text
    CHECK (tecnica_avaliacao IS NULL OR tecnica_avaliacao IN ('QUALITATIVA', 'QUANTITATIVA')),
  ADD COLUMN IF NOT EXISTS base_legal text;

COMMENT ON COLUMN public.sgsst_riscos_catalogo.limite_tolerancia IS
  'Limite de tolerancia numerico, para comparar com a medicao. NULL quando o limite depende da substancia ou do tempo de exposicao — nesses casos a base_legal aponta o anexo.';
COMMENT ON COLUMN public.sgsst_riscos_catalogo.unidade_medida IS
  'Unidade do limite: dB(A), mg/m3, ppm, m/s2, IBUTG. Numero sem unidade nao significa nada.';
COMMENT ON COLUMN public.sgsst_riscos_catalogo.tecnica_avaliacao IS
  'QUANTITATIVA exige medicao instrumental. QUALITATIVA e avaliada por inspecao e analise da atividade.';
COMMENT ON COLUMN public.sgsst_riscos_catalogo.base_legal IS
  'Norma que fundamenta o limite adotado. Ex.: NR-15 Anexo 1, NR-15 Anexo 11, NR-09.';

-- =====================================================================
-- Enriquece o catalogo padrao
-- =====================================================================
-- Os codigos correspondem a src/utils/sgsstRiscosDefaults.ts. O UPDATE so
-- preenche onde ainda esta nulo, para nao sobrescrever ajuste que o usuario
-- tenha feito.
--
-- IMPORTANTE sobre os limites: so foi semeado numero que pode ser afirmado sem
-- ambiguidade. O ruido continuo tem limite fechado na NR-15 Anexo 1 (85 dB(A)
-- para 8 horas). Os agentes quimicos tem limite por substancia, em tabela do
-- Anexo 11, e variam com o tempo de exposicao — semear um numero generico ali
-- seria inventar dado tecnico. Nesses casos fica so a base legal, e quem elabora
-- o PGR preenche o limite da substancia especifica.

-- Fisicos: os de medicao instrumental
UPDATE public.sgsst_riscos_catalogo SET
  limite_tolerancia = COALESCE(limite_tolerancia, 85),
  unidade_medida = COALESCE(unidade_medida, 'dB(A)'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 1 — 85 dB(A) para 8h de exposição')
WHERE codigo = 'FIS-01';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'm/s²'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 8 — vibração de corpo inteiro (VDVR e aren)')
WHERE codigo = 'FIS-02';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'm/s²'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 8 — vibração em mãos e braços (aren)')
WHERE codigo = 'FIS-03';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'IBUTG °C'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 3 — limite varia com o regime de trabalho e descanso')
WHERE codigo = 'FIS-04';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 7 — radiações não ionizantes')
WHERE codigo = 'FIS-05';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 10 — umidade')
WHERE codigo = 'FIS-06';

-- Quimicos: limite por substancia, no Anexo 11 ou 12
UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'mg/m³'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 12 — poeiras minerais; limite calculado pela fração respirável')
WHERE codigo = 'QUI-01';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'mg/m³'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-09 — sem limite específico na NR-15; avaliar pela ACGIH')
WHERE codigo = 'QUI-02';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'ppm'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 11 — limite por substância (tolueno, xileno)')
WHERE codigo = 'QUI-03';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, 'mg/m³'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 11 — fumos metálicos; limite por metal')
WHERE codigo = 'QUI-04';

UPDATE public.sgsst_riscos_catalogo SET
  unidade_medida = COALESCE(unidade_medida, '% O₂'),
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUANTITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-33 — atmosfera entre 20,9% e 23% de O₂; medição obrigatória antes da entrada')
WHERE codigo = 'QUI-05';

-- Biologicos e ergonomicos: avaliacao qualitativa
UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-15 Anexo 14 — agentes biológicos; avaliação qualitativa')
WHERE codigo IN ('BIO-01', 'BIO-02');

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-17 — análise ergonômica do trabalho (AET)')
WHERE codigo IN ('ERG-01', 'ERG-02', 'ERG-03', 'ERG-04');

-- Acidentes: qualitativa, com a norma especifica de cada um
UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-35 — trabalho em altura acima de 2,00 m')
WHERE codigo = 'ACI-01';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-18 — proteção contra queda de materiais')
WHERE codigo = 'ACI-02';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-10 — segurança em instalações e serviços em eletricidade')
WHERE codigo = 'ACI-03';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-12 — máquinas e equipamentos')
WHERE codigo = 'ACI-04';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-18 — escavações, fundações e desmonte')
WHERE codigo = 'ACI-05';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-11 e NR-12 — transporte e movimentação de materiais')
WHERE codigo = 'ACI-06';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-23 — proteção contra incêndios')
WHERE codigo = 'ACI-07';

UPDATE public.sgsst_riscos_catalogo SET
  tecnica_avaliacao = COALESCE(tecnica_avaliacao, 'QUALITATIVA'),
  base_legal = COALESCE(base_legal, 'NR-18 e NR-06 — proteção contra cortes e perfurações')
WHERE codigo = 'ACI-08';

-- Indice para o filtro por tecnica na tela de Riscos.
CREATE INDEX IF NOT EXISTS idx_sgsst_riscos_tecnica
  ON public.sgsst_riscos_catalogo(empresa_id, tecnica_avaliacao)
  WHERE tecnica_avaliacao IS NOT NULL;
