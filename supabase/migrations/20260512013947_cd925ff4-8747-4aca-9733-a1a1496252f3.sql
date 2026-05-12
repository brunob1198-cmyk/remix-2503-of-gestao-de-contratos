DROP TABLE IF EXISTS public.mkp_parametros CASCADE;

CREATE TABLE public.mkp_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  obra_codigo text,
  perc_custo_direto numeric(7,5) NOT NULL DEFAULT 0,
  perc_gerencia     numeric(7,5) NOT NULL DEFAULT 0,
  perc_risco        numeric(7,5) NOT NULL DEFAULT 0,
  perc_treinamento  numeric(7,5) NOT NULL DEFAULT 0,
  perc_inflacao     numeric(7,5) NOT NULL DEFAULT 0,
  perc_mb_esperado  numeric(7,5) NOT NULL DEFAULT 0,
  bdi_venda         numeric(8,4) NOT NULL DEFAULT 1,
  area text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(projeto_id)
);

ALTER TABLE public.mkp_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkp_parametros_all" ON public.mkp_parametros FOR ALL USING (true);

CREATE TRIGGER update_mkp_parametros_updated_at
BEFORE UPDATE ON public.mkp_parametros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();