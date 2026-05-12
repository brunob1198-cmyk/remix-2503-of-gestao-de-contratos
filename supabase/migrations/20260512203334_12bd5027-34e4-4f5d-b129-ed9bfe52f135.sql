-- Remover a coluna gerada atual
ALTER TABLE public.projeto_impostos DROP COLUMN perc_total_impostos;

-- Recriar a coluna gerada incluindo IRPJ e CSLL
-- Usando COALESCE para garantir que valores nulos sejam tratados como zero no cálculo
ALTER TABLE public.projeto_impostos ADD COLUMN perc_total_impostos numeric(7,5) GENERATED ALWAYS AS
  (perc_issqn + perc_pis + perc_cofins + perc_inss + perc_dara + perc_icms + COALESCE(perc_irpj, 0) + COALESCE(perc_csll, 0))
  STORED;