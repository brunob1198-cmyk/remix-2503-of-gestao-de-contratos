-- Migration: campos que a NR-07 exige no PCMSO (Fase 1 do plano)
--
-- A NR-07, item 7.5, lista o que precisa estar escrito no programa. Tres desses
-- itens nao tinham campo nenhum: os agravos a saude por risco, os criterios de
-- interpretacao/conduta, e a ligacao entre cada exame previsto e o risco que o
-- justifica. Sem eles o PCMSO da tela nao vira documento emitivel.
--
-- Decisao de escopo (tomada com o usuario em 19/08/2026): o agrupamento continua
-- sendo por FUNCAO, nao por GHE. Uma funcao pode pertencer a GHEs diferentes
-- conforme a obra, mas funcao atende a maioria dos casos e evita um cadastro
-- paralelo. Se um dia virar GHE, o caminho e trocar funcao_id por ghe_id aqui.

-- =====================================================================
-- 1. Documento-base do programa
-- =====================================================================
ALTER TABLE public.sgsst_pcmso
  ADD COLUMN IF NOT EXISTS agravos_saude text,
  ADD COLUMN IF NOT EXISTS criterios_conduta text,
  -- Ano de referencia: o relatorio analitico e anual e precisa saber a qual
  -- exercicio o programa se refere, sem depender de extrair da data_inicio.
  ADD COLUMN IF NOT EXISTS ano_referencia integer;

COMMENT ON COLUMN public.sgsst_pcmso.agravos_saude IS
  'NR-07 7.5: descricao dos possiveis agravos a saude relacionados aos riscos ocupacionais identificados.';
COMMENT ON COLUMN public.sgsst_pcmso.criterios_conduta IS
  'NR-07 7.5: criterios de interpretacao dos achados e condutas decorrentes.';

-- Preenche o ano de referencia dos registros existentes a partir da data de
-- inicio, para nao deixar o campo nulo em quem ja foi cadastrado.
UPDATE public.sgsst_pcmso
SET ano_referencia = EXTRACT(year FROM data_inicio)::integer
WHERE ano_referencia IS NULL;

-- =====================================================================
-- 2. Quadro de exames previstos
-- =====================================================================
ALTER TABLE public.sgsst_pcmso_exames
  ADD COLUMN IF NOT EXISTS justificativa_tecnica text,
  ADD COLUMN IF NOT EXISTS base_legal text,
  -- A NR-07 (7.5.4.2) diferencia a periodicidade do exame clinico por idade:
  -- anual ate 18 e acima de 45 anos, bienal entre 18 e 45. Sem este campo o
  -- sistema nao consegue calcular a data do proximo exame de cada trabalhador,
  -- o que inviabiliza a convocacao.
  ADD COLUMN IF NOT EXISTS faixa_etaria text
    CHECK (faixa_etaria IS NULL OR faixa_etaria IN ('TODAS', 'MENOR_18', 'ENTRE_18_45', 'MAIOR_45')),
  -- Substitui o `grupo_risco` em texto livre por vinculo ao catalogo, que e o
  -- mesmo usado por PGR, APR e PT. O campo antigo fica, para nao perder o que
  -- ja foi digitado.
  ADD COLUMN IF NOT EXISTS risco_catalogo_id uuid
    REFERENCES public.sgsst_riscos_catalogo(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sgsst_pcmso_exames.justificativa_tecnica IS
  'Correlacao entre o risco e o exame indicado. Exigida na defesa tecnica do programa.';
COMMENT ON COLUMN public.sgsst_pcmso_exames.base_legal IS
  'Referencia normativa do exame. Ex.: NR-07 Anexo I, NR-15 Anexo 11, ACGIH.';
COMMENT ON COLUMN public.sgsst_pcmso_exames.faixa_etaria IS
  'Faixa etaria a que a periodicidade se aplica (NR-07 7.5.4.2). NULL ou TODAS = sem distincao.';
COMMENT ON COLUMN public.sgsst_pcmso_exames.grupo_risco IS
  'OBSOLETO: texto livre mantido por compatibilidade. Use risco_catalogo_id.';

-- Registros existentes passam a valer para todas as faixas, que era o
-- comportamento implicito antes do campo existir.
UPDATE public.sgsst_pcmso_exames
SET faixa_etaria = 'TODAS'
WHERE faixa_etaria IS NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_ex_risco
  ON public.sgsst_pcmso_exames(risco_catalogo_id)
  WHERE risco_catalogo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_ano
  ON public.sgsst_pcmso(empresa_id, ano_referencia);
