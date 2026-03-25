
-- Tabela de faturas (cabeçalho)
CREATE TABLE public.faturamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  numero_fatura VARCHAR,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_bruto NUMERIC NOT NULL DEFAULT 0,
  impostos_percentual NUMERIC NOT NULL DEFAULT 0,
  impostos_valor NUMERIC NOT NULL DEFAULT 0,
  descontos NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'emitido',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens da fatura (rastreabilidade)
CREATE TABLE public.faturamento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_id UUID REFERENCES public.faturamentos(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES public.sites(id) NOT NULL,
  item_lpu_id UUID REFERENCES public.itens_lpu(id) NOT NULL,
  quantidade_faturada NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_faturado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.faturamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_access" ON public.faturamentos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.faturamento_itens FOR ALL TO public USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_faturamentos_updated_at
  BEFORE UPDATE ON public.faturamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
