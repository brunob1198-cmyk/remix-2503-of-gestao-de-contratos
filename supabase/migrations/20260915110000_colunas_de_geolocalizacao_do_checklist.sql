-- As colunas de geolocalizacao do modelo de checklist, que nunca chegaram ao banco
--
-- O QUE ACONTECEU
--
-- A migration `20260817010000_checklists_evolution_prompt020.sql` acrescenta cinco
-- colunas em `checklist_modelos` — `exigir_geolocalizacao`, `latitude_alvo`,
-- `longitude_alvo`, `raio_permitido_metros` e `bloquear_fora_raio`. Ela existe no
-- repositorio e NAO foi aplicada neste banco.
--
-- Ninguem percebeu por um motivo especifico: o INSERT que criava modelos nunca
-- mencionou essas colunas. A tela coletava a configuracao de GPS desde entao e o
-- codigo simplesmente nao a enviava — e um INSERT que ignora uma coluna funciona
-- igual quando ela existe e quando ela nao existe. O defeito so apareceu quando
-- `salvar_modelo_de_checklist` passou a gravar o que a tela coleta:
--
--   column "exigir_geolocalizacao" does not exist
--
-- Ou seja: a funcao nova nao quebrou nada. Ela tornou visivel uma coluna que
-- faltava ha meses, e com ela o fato de que a configuracao de GPS do checklist
-- nunca funcionou.
--
-- POR QUE ESTE ARQUIVO, E NAO "RODE O 020"
--
-- Aquela migration faz muito mais que isto: cria a tabela `checklist_qrcodes`,
-- funcoes e politicas. Rodar o arquivo inteiro hoje, fora de ordem, mexeria em
-- coisas que nao tem relacao com o defeito. Aqui vai so o que falta para o
-- salvamento funcionar.
--
-- `IF NOT EXISTS` em tudo: se alguma das colunas ja estiver la, o comando nao faz
-- nada. Rodar duas vezes e seguro.

ALTER TABLE public.checklist_modelos
  ADD COLUMN IF NOT EXISTS exigir_geolocalizacao text DEFAULT 'nao',
  ADD COLUMN IF NOT EXISTS latitude_alvo numeric,
  ADD COLUMN IF NOT EXISTS longitude_alvo numeric,
  ADD COLUMN IF NOT EXISTS raio_permitido_metros integer,
  ADD COLUMN IF NOT EXISTS bloquear_fora_raio boolean DEFAULT false;

COMMENT ON COLUMN public.checklist_modelos.exigir_geolocalizacao IS
  'Quando pedir a posicao do aplicador: nao | iniciar | finalizar | ambos.';
COMMENT ON COLUMN public.checklist_modelos.raio_permitido_metros IS
  'Distancia maxima, em metros, entre o aplicador e o ponto alvo.';
COMMENT ON COLUMN public.checklist_modelos.bloquear_fora_raio IS
  'Fora do raio, impede o preenchimento em vez de so registrar o desvio.';

-- `critico` tambem veio de uma migration posterior
-- (`20260825100000_checklist_item_critico.sql`). Neste banco ela parece aplicada,
-- porque o INSERT antigo ja gravava a coluna e criar modelo funcionava. Fica aqui
-- pelo mesmo `IF NOT EXISTS`: se estiver, nada acontece; se nao estiver, a funcao
-- de salvar quebraria no proximo item marcado como critico.
ALTER TABLE public.checklist_itens
  ADD COLUMN IF NOT EXISTS critico boolean NOT NULL DEFAULT false;
