
-- Create recursos table
CREATE TABLE public.recursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pessoa', 'equipamento', 'veiculo')),
  unidade TEXT NOT NULL DEFAULT 'hora' CHECK (unidade IN ('hora', 'dia')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recurso_custos table
CREATE TABLE public.recurso_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recurso_id UUID NOT NULL REFERENCES public.recursos(id) ON DELETE CASCADE,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurso_custos ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching existing pattern)
CREATE POLICY "public_access" ON public.recursos FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "public_access" ON public.recurso_custos FOR ALL TO public USING (true) WITH CHECK (true);

-- Updated_at trigger for recursos
CREATE TRIGGER update_recursos_updated_at
  BEFORE UPDATE ON public.recursos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
