-- Migration: CEP e complemento do endereco do colaborador
--
-- O cadastro tinha um unico campo `endereco`, de texto livre, digitado inteiro a
-- mao. Isso custa duas coisas:
--
--   1. O endereco sai diferente a cada cadastro — "Ap. de Goiania", "Aparecida de
--      Goiania", "APARECIDA GO" — e nao serve para conferencia nem para agrupar.
--   2. O CEP, que e o dado que permite conferir o endereco na base dos Correios,
--      nao era guardado em lugar nenhum.
--
-- Passa a haver `cep` (guardado) e `endereco_complemento` (numero, quadra, lote).
-- O campo `endereco` continua existindo e passa a ser preenchido pela consulta ao
-- CEP — logradouro, bairro, cidade e UF —, com o complemento digitado a parte.
--
-- Por que o complemento em coluna propria: sem ela, digitar o numero significa
-- clicar no meio do texto que a consulta acabou de preencher, e qualquer nova
-- consulta apagaria o numero junto. Separar preserva o que o usuario digitou.

ALTER TABLE public.sgsst_colaborador_dados
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text;

COMMENT ON COLUMN public.sgsst_colaborador_dados.cep IS
  'CEP do endereco residencial, mascarado (XX.XXX-XXX). Alimenta a consulta a base dos Correios que preenche `endereco`.';

COMMENT ON COLUMN public.sgsst_colaborador_dados.endereco IS
  'Logradouro, bairro, cidade e UF — preenchido pela consulta ao CEP. O numero e o complemento ficam em `endereco_complemento`.';

COMMENT ON COLUMN public.sgsst_colaborador_dados.endereco_complemento IS
  'Numero, quadra, lote, apartamento. Fica separado para que uma nova consulta de CEP nao apague o que o usuario digitou.';
