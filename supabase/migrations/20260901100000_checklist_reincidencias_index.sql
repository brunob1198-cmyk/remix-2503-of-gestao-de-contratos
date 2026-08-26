-- Índice de apoio ao relatório de Reincidências dos Checklists.
--
-- O relatório agrupa checklist_respostas reprovadas (is_nao_conforme = true) por
-- item, para achar o mesmo item falhando repetidamente ao longo do tempo. A
-- tabela checklist_respostas hoje só tem índice em aplicacao_id (para o join com
-- a aplicação-mãe) — sem um índice em item_id, cada carregamento da aba varre a
-- tabela inteira mesmo filtrando por não-conforme. O índice é parcial (WHERE
-- is_nao_conforme = true) porque é exatamente esse subconjunto que o relatório lê;
-- indexar as respostas conformes também só inflaria o índice sem uso.
CREATE INDEX IF NOT EXISTS idx_checklist_resp_item_nc
  ON public.checklist_respostas (item_id)
  WHERE is_nao_conforme = true;

NOTIFY pgrst, 'reload schema';
