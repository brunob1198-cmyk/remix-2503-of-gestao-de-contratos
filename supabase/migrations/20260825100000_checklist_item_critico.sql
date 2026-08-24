-- Migration: item critico no modelo de checklist
--
-- A tabela `checklist_respostas` tinha `is_critico` desde o inicio, gravado e nunca
-- lido — e a tela nunca o definia, entao era sempre falso. Coluna morta nas duas
-- pontas.
--
-- O que faltava era a outra metade: o item do MODELO nao tinha como ser marcado
-- como critico. Sem isso, `is_critico` na resposta nao tinha de onde vir.
--
-- A regra que passa a valer: item critico e IMPEDITIVO. Nao conformidade nele
-- reprova o checklist inteiro, independente do percentual.
--
-- Por que independente do percentual: um checklist de quarenta itens com o
-- "extintor obstruido" nao conforme e trinta e nove conformes da 97,5% de
-- conformidade. O numero esta certo e a conclusao esta errada — o canteiro nao
-- pode operar. Peso alto ajuda, mas nao resolve: por definicao ha item que nao se
-- compensa com quantidade de acertos.
--
-- Por isso o veredito e SEPARADO do percentual, e nenhum dos dois e alterado para
-- forcar o outro. Zerar o percentual esconderia quantos itens estavam certos;
-- ignorar o item critico esconderia que o trabalho nao pode comecar.

-- =====================================================================
-- 1. O item pode ser critico
-- =====================================================================
ALTER TABLE public.checklist_itens
  ADD COLUMN IF NOT EXISTS critico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.checklist_itens.critico IS
  'Item impeditivo: nao conformidade nele reprova o checklist inteiro, independente do percentual de conformidade. Nao confundir com peso_pontuacao, que gradua a nota — critico nao gradua, veta.';

COMMENT ON COLUMN public.checklist_respostas.is_critico IS
  'Copia da marcacao `critico` do item no momento da resposta. Fica congelada na resposta porque o modelo pode mudar depois, e o veredito de uma aplicacao antiga tem de continuar explicavel pelos dados dela.';

-- Item critico que ninguem respondeu deixa o veredito indefinido, e por isso a
-- aplicacao passa a exigir resposta nele. Marcar tambem como obrigatorio evita que
-- modelos existentes fiquem com item critico opcional — o que seria contraditorio.
UPDATE public.checklist_itens SET obrigatorio = true WHERE critico = true AND obrigatorio = false;

-- =====================================================================
-- 2. O veredito, na aplicacao
-- =====================================================================
-- Coluna e nao calculo derivado: a lista de aplicacoes nao carrega as respostas,
-- e sem a coluna a tela nao teria como mostrar "reprovado" sem uma consulta por
-- linha.
ALTER TABLE public.checklist_aplicacoes
  ADD COLUMN IF NOT EXISTS reprovado_por_item_critico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS itens_criticos_nao_conformes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.checklist_aplicacoes.reprovado_por_item_critico IS
  'Verdadeiro quando ao menos um item critico saiu nao conforme. O percentual de conformidade continua sendo o percentual — o veredito e informacao separada, porque zerar a nota esconderia quantos itens estavam certos.';

COMMENT ON COLUMN public.checklist_aplicacoes.itens_criticos_nao_conformes IS
  'Quantos itens criticos sairam nao conformes. Um ja reprova; o numero diz o tamanho do problema.';

-- =====================================================================
-- 3. Coerencia entre a contagem e o veredito
-- =====================================================================
-- Sem esta trava, uma escrita poderia gravar "reprovado" com zero item critico nao
-- conforme, ou o contrario — e o documento emitido citaria um numero que nao
-- sustenta a conclusao impressa ao lado.
CREATE OR REPLACE FUNCTION public.check_sgsst_checklist_veredito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.itens_criticos_nao_conformes < 0 THEN
    RAISE EXCEPTION 'A contagem de itens críticos não conformes não pode ser negativa.';
  END IF;

  IF NEW.reprovado_por_item_critico AND NEW.itens_criticos_nao_conformes = 0 THEN
    RAISE EXCEPTION 'Reprovação por item crítico exige ao menos um item crítico não conforme.';
  END IF;

  IF NOT NEW.reprovado_por_item_critico AND NEW.itens_criticos_nao_conformes > 0 THEN
    RAISE EXCEPTION 'Há % item(ns) crítico(s) não conforme(s): a aplicação não pode ficar sem a reprovação.',
      NEW.itens_criticos_nao_conformes;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_veredito ON public.checklist_aplicacoes;
CREATE TRIGGER trg_checklist_veredito
  BEFORE INSERT OR UPDATE ON public.checklist_aplicacoes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_checklist_veredito();

-- =====================================================================
-- 4. Indice do painel
-- =====================================================================
-- "Quais aplicacoes foram reprovadas" e a consulta que a tela faz primeiro.
CREATE INDEX IF NOT EXISTS idx_checklist_apl_reprovado
  ON public.checklist_aplicacoes(empresa_id, reprovado_por_item_critico)
  WHERE reprovado_por_item_critico = true;
