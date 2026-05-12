ALTER TABLE public.projeto_impostos 
ADD COLUMN perc_irpj NUMERIC DEFAULT 0,
ADD COLUMN perc_csll NUMERIC DEFAULT 0;