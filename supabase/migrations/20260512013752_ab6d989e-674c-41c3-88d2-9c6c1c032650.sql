CREATE TABLE public.projeto_impostos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  perc_issqn  numeric(7,5) NOT NULL DEFAULT 0,
  perc_pis    numeric(7,5) NOT NULL DEFAULT 0,
  perc_cofins numeric(7,5) NOT NULL DEFAULT 0,
  perc_inss   numeric(7,5) NOT NULL DEFAULT 0,
  perc_dara   numeric(7,5) NOT NULL DEFAULT 0,
  perc_icms   numeric(7,5) NOT NULL DEFAULT 0,
  perc_total_impostos numeric(7,5) GENERATED ALWAYS AS
    (perc_issqn + perc_pis + perc_cofins + perc_inss + perc_dara + perc_icms)
    STORED,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(projeto_id)
);

ALTER TABLE public.projeto_impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projeto_impostos_all" ON public.projeto_impostos FOR ALL USING (true);

CREATE TRIGGER update_projeto_impostos_updated_at
BEFORE UPDATE ON public.projeto_impostos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();