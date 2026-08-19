-- Migration: coluna gerada `abaixo_minimo` em sgsst_epis
--
-- O indicador "estoque abaixo do minimo" era calculado no cliente
-- (estoque_atual <= estoque_minimo) sobre a pagina carregada, entao com o
-- catalogo paginado ele contava apenas os EPIs visiveis — subestimando
-- justamente o numero que dispara reposicao.
--
-- O PostgREST compara coluna com valor, nunca coluna com coluna, portanto o
-- filtro so existe no servidor se a comparacao virar uma coluna. A coluna
-- gerada resolve isso e mantem o valor sempre coerente com os dois estoques.
--
-- Observacao: esta migration e adicionada separadamente porque
-- 20260814010000_create_sgsst_epi_tables.sql ja foi aplicada neste ambiente.

ALTER TABLE public.sgsst_epis
  ADD COLUMN IF NOT EXISTS abaixo_minimo boolean
  GENERATED ALWAYS AS (estoque_atual <= estoque_minimo) STORED;

-- Indice parcial: as consultas de reposicao buscam sempre o lado verdadeiro,
-- que tende a ser a minoria das linhas.
CREATE INDEX IF NOT EXISTS idx_sgsst_epis_abaixo_minimo
  ON public.sgsst_epis(empresa_id)
  WHERE abaixo_minimo;

-- Indice para as contagens por validade de CA (CA vencido / a vencer).
CREATE INDEX IF NOT EXISTS idx_sgsst_epis_validade_ca
  ON public.sgsst_epis(empresa_id, validade_ca);
