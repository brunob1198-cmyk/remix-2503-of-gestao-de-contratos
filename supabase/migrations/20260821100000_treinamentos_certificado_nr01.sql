-- Migration: campos que a NR-01 exige no certificado de treinamento
-- (Etapa 1 do plano de Treinamentos)
--
-- A NR-01, no item 1.7, lista o que o certificado deve conter ao fim de
-- treinamento inicial, periodico ou eventual:
--
--   1. nome e ASSINATURA do trabalhador
--   2. CONTEUDO PROGRAMATICO
--   3. carga horaria
--   4. data e local do treinamento
--   5. nome e QUALIFICACAO dos instrutores
--   6. ASSINATURA DO RESPONSAVEL TECNICO pelo treinamento
--
-- O sistema tinha 3 e 4. Esta migration cobre 2, 5 e 6. A assinatura do
-- trabalhador (1) nao e campo de banco: e uma linha impressa no certificado, e
-- entra na etapa 2 junto da emissao.
--
-- Sem esses campos o modulo controlava a validade de um certificado que nao
-- produzia — e, se produzisse, sairia fora da norma.

-- =====================================================================
-- 1. Conteudo programatico e base legal, no treinamento
-- =====================================================================
-- Ficam no TREINAMENTO e nao na turma: o conteudo e do curso, e repeti-lo em
-- cada turma abriria espaco para duas turmas do mesmo curso divergirem no que
-- foi ensinado.
ALTER TABLE public.sgsst_treinamentos
  ADD COLUMN IF NOT EXISTS conteudo_programatico text,
  ADD COLUMN IF NOT EXISTS base_legal text;

COMMENT ON COLUMN public.sgsst_treinamentos.conteudo_programatico IS
  'Conteudo programatico do curso. Item obrigatorio do certificado (NR-01 1.7). Diferente de `descricao`, que e texto livre de apresentacao.';
COMMENT ON COLUMN public.sgsst_treinamentos.base_legal IS
  'Norma que exige o treinamento (ex.: NR-35 item 35.3.2). Serve para justificar a obrigatoriedade e para o certificado citar o fundamento.';

-- =====================================================================
-- 2. Tipo do treinamento, instrutor e responsavel tecnico, na turma
-- =====================================================================
-- Ficam na TURMA porque variam de uma oferta para outra: o mesmo curso pode ser
-- inicial para um grupo e reciclagem para outro, com instrutor diferente.
ALTER TABLE public.sgsst_treinamentos_turmas
  -- A classificacao da propria NR-01. Nao confundir com `categoria` do
  -- treinamento, que e assunto (NR, Integracao, Comportamental...).
  ADD COLUMN IF NOT EXISTS tipo_treinamento text NOT NULL DEFAULT 'INICIAL'
    CHECK (tipo_treinamento IN ('INICIAL', 'PERIODICO', 'EVENTUAL')),

  -- Item 5 do certificado: nome E qualificacao. O nome ja existia em
  -- `instrutor`; sem a qualificacao o certificado fica incompleto.
  ADD COLUMN IF NOT EXISTS instrutor_qualificacao text,

  -- Item 6: quem assina tecnicamente pelo treinamento. Pode ser o proprio
  -- instrutor, mas e um papel distinto e a norma pede a assinatura dele.
  ADD COLUMN IF NOT EXISTS responsavel_tecnico text,
  ADD COLUMN IF NOT EXISTS registro_responsavel text,

  -- Identificacao da organizacao congelada na turma. Mesmo motivo do PGR e do
  -- ASO: ler de `empresas` na hora de imprimir faria certificados antigos
  -- passarem a mostrar o nome novo se a empresa fosse renomeada.
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS empresa_cnpj text;

COMMENT ON COLUMN public.sgsst_treinamentos_turmas.tipo_treinamento IS
  'INICIAL, PERIODICO (reciclagem) ou EVENTUAL — a classificacao da NR-01 1.7. O certificado precisa dizer qual.';
COMMENT ON COLUMN public.sgsst_treinamentos_turmas.instrutor IS
  'Nome do instrutor. A NR-01 exige nome E qualificacao no certificado; a qualificacao esta em instrutor_qualificacao.';
COMMENT ON COLUMN public.sgsst_treinamentos_turmas.responsavel_tecnico IS
  'Responsavel tecnico pelo treinamento, que assina o certificado (NR-01 1.7). Pode ser a mesma pessoa do instrutor, mas o papel e distinto.';

-- Retro-preenche a identificacao da organizacao nas turmas que ja existem, para
-- certificado emitido delas nao sair sem nome nem CNPJ.
UPDATE public.sgsst_treinamentos_turmas t
SET empresa_nome = e.nome,
    empresa_cnpj = e.cnpj
FROM public.empresas e
WHERE e.id = t.empresa_id
  AND t.empresa_nome IS NULL;

-- =====================================================================
-- 3. Numero do certificado
-- =====================================================================
-- A coluna `certificado` ja existia como texto solto. Passa a ser, oficialmente,
-- o numero do certificado — sem criar coluna nova para a mesma coisa.
COMMENT ON COLUMN public.sgsst_treinamentos_participantes.certificado IS
  'Numero do certificado emitido. Em branco significa nao numerado — o PDF sai marcando a pendencia em vez de omitir.';

-- Numero de certificado nao repete dentro da mesma empresa, quando informado.
-- Dois certificados com o mesmo numero tornam a rastreabilidade inutil.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_tr_part_certificado
  ON public.sgsst_treinamentos_participantes(empresa_id, certificado)
  WHERE certificado IS NOT NULL AND certificado <> '';

-- =====================================================================
-- 4. Coerencia das datas da turma
-- =====================================================================
-- Data final anterior a inicial e erro de digitacao, e sairia impressa no
-- certificado — documento assinado com periodo impossivel.
CREATE OR REPLACE FUNCTION public.check_sgsst_turma_datas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_final IS NOT NULL AND NEW.data_final < NEW.data_inicial THEN
    RAISE EXCEPTION 'A data final da turma não pode ser anterior à data inicial.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_turma_datas ON public.sgsst_treinamentos_turmas;
CREATE TRIGGER trg_sgsst_turma_datas
  BEFORE INSERT OR UPDATE ON public.sgsst_treinamentos_turmas
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_turma_datas();

-- =====================================================================
-- 5. Indice para a emissao em lote
-- =====================================================================
-- A etapa 3 emite os certificados de uma turma inteira: a consulta e por turma
-- filtrando aprovados.
CREATE INDEX IF NOT EXISTS idx_sgsst_tr_part_turma_aprovacao
  ON public.sgsst_treinamentos_participantes(turma_id, aprovacao);
