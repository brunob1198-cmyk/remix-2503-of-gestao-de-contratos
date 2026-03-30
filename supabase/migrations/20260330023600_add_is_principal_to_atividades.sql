-- Add is_principal boolean to atividades_planejamento
ALTER TABLE public.atividades_planejamento ADD COLUMN is_principal boolean NOT NULL DEFAULT false;

-- Comment for the schema
COMMENT ON COLUMN public.atividades_planejamento.is_principal IS 'Indicates if this activity is the main driver for the Frentes deadline calculation.';
