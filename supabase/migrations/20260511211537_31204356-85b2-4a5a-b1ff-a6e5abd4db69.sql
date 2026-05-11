-- Create the mkp_parametros table
CREATE TABLE public.mkp_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  obra_codigo text,
  perc_custo_direto numeric(6,4) NOT NULL DEFAULT 0,
  perc_gerencia numeric(6,4) NOT NULL DEFAULT 0,
  perc_risco numeric(6,4) NOT NULL DEFAULT 0,
  perc_treinamento numeric(6,4) NOT NULL DEFAULT 0,
  perc_inflacao numeric(6,4) NOT NULL DEFAULT 0,
  perc_impostos numeric(6,4) NOT NULL DEFAULT 0.0865,
  perc_mb_esperado numeric(6,4) NOT NULL DEFAULT 0,
  bdi_venda numeric(8,4) NOT NULL DEFAULT 1,
  area text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(projeto_id)
);

-- Enable Row Level Security
ALTER TABLE public.mkp_parametros ENABLE ROW LEVEL SECURITY;

-- Create policy (following user request for "all using true")
CREATE POLICY "mkp_parametros_all" ON public.mkp_parametros FOR ALL USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_mkp_parametros_updated_at
BEFORE UPDATE ON public.mkp_parametros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();