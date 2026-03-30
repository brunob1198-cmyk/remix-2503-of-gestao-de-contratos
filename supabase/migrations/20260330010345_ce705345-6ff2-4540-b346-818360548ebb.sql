-- Create a table for contracts
CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) NOT NULL,
  arquivo_url TEXT,
  status_processamento TEXT DEFAULT 'pendente',
  cliente_ids UUID[] DEFAULT '{}',
  valor_total NUMERIC,
  prazo_inicio DATE,
  prazo_fim DATE,
  escopo TEXT,
  condicoes_pagamento TEXT,
  garantias TEXT,
  liberacao_garantias TEXT,
  medicoes TEXT,
  multas TEXT,
  reajuste TEXT,
  observacoes TEXT,
  contrato_pai_id UUID REFERENCES public.contratos(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
CREATE POLICY "Users can view company contracts" 
ON public.contratos 
FOR SELECT 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can create company contracts" 
ON public.contratos 
FOR INSERT 
WITH CHECK (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update company contracts" 
ON public.contratos 
FOR UPDATE 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete company contracts" 
ON public.contratos 
FOR DELETE 
USING (empresa_id IN (
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_contratos_updated_at
BEFORE UPDATE ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();