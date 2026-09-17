-- O papel timbrado passa a ser de cada empresa
--
-- DECISAO DO DONO, 17/09/2026
--
-- O roteiro 0.5 manda "conferir se o logotipo e o endereco da empresa estao
-- preenchidos em Configuracoes", e o balanco da R0 mostrou que isso descrevia
-- algo que nao existia:
--
--   * `sgsstPapelTimbrado.ts` tinha o logo, o CNPJ, o endereco, o telefone, o
--     e-mail e o site FIXOS no codigo, da AIVX. Todo PDF de todo cliente saia
--     com o timbre da fabricante da ferramenta.
--   * `empresas` nao tinha coluna de endereco. Nao havia onde preencher.
--   * Nao havia tela de Configuracoes da empresa.
--
-- A decisao foi: o sistema MONTA o timbre a partir da logo e dos dados
-- cadastrados, como ja fazia com os da AIVX. Nao e um arquivo de papel timbrado
-- pronto enviado pelo cliente — assim o cabecalho e o rodape continuam com texto
-- selecionavel, paginacao automatica e a mesma geometria em todos os documentos.
--
-- O QUE ESTA MIGRATION FAZ
--
-- Acrescenta a `empresas` os quatro campos que faltavam para o rodape. `nome`,
-- `cnpj` e `logo_url` ja existiam — e a logo e a MESMA do cabecalho das telas,
-- por decisao do dono: um lugar de preenchimento, dois usos.
--
-- NENHUM VALOR PADRAO, E ESSE E O PONTO
--
-- As colunas nascem nulas. Seria facil semear aqui os dados da AIVX para o
-- timbre "continuar funcionando" — e seria exatamente o defeito que esta
-- migration existe para fechar: o CNPJ de uma empresa no documento de outra.
--
-- Empresa que ainda nao preencheu emite documento SEM aquele pedaco do rodape,
-- e a tela de Configuracoes diz quais faltam e o que cada falta causa. Rodape
-- incompleto e um problema visivel; rodape com o CNPJ errado e um problema que
-- so aparece na auditoria.
--
-- RLS: NADA A FAZER
--
-- `empresas` ja tem as politicas certas desde 20260321182218 — SELECT para quem
-- e da empresa, UPDATE so para o admin dela. E o que a decisao pede: visivel
-- para todos os usuarios, editavel pelos admin.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS site text;

COMMENT ON COLUMN public.empresas.endereco IS
  'Endereco completo, em uma linha. Sai centralizado na segunda linha do rodape de todo PDF do SGSST.';

COMMENT ON COLUMN public.empresas.telefone IS
  'Telefone de contato. Sai na primeira linha do rodape, entre o CNPJ e o e-mail.';

COMMENT ON COLUMN public.empresas.email IS
  'E-mail de contato. Sai na primeira linha do rodape.';

COMMENT ON COLUMN public.empresas.site IS
  'Site, sem protocolo (ex.: minhaempresa.com.br). Abre a primeira linha do rodape.';

COMMENT ON COLUMN public.empresas.logo_url IS
  'Logotipo da empresa. Usado em DOIS lugares: o cabecalho das telas e o topo de todo PDF timbrado do SGSST. Gravado por useCustomLogo; so o admin da empresa pode alterar.';

-- ============================================================================
-- Como conferir
-- ============================================================================
--
--   SELECT nome, cnpj, endereco, telefone, email, site,
--          (logo_url IS NOT NULL) AS tem_logo
--     FROM public.empresas;
--
-- O que estiver nulo simplesmente nao aparece no rodape — nada e inventado.
