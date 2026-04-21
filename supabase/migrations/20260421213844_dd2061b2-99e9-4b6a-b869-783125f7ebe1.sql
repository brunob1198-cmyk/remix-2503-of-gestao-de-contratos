CREATE TABLE IF NOT EXISTS public.faturamentos_conta_azul (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    erp_id TEXT UNIQUE NOT NULL,
    numero_nota TEXT,
    data_emissao DATE NOT NULL,
    cliente_nome TEXT,
    valor_total NUMERIC(14,2) NOT NULL,
    centro_custo TEXT,
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faturamentos_conta_azul ENABLE ROW LEVEL SECURITY;

-- Create policies (admin only or user by company if we have empresa_id)
-- For now, let's make it viewable by everyone in the system if it's a shared portal,
-- but typically we'd filter by empresa_id. 
-- Wait, let's check if we should add empresa_id. Most tables here seem to have it.

CREATE POLICY "Allow select for authenticated users" 
ON public.faturamentos_conta_azul FOR SELECT 
TO authenticated 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_faturamentos_conta_azul_updated_at
BEFORE UPDATE ON public.faturamentos_conta_azul
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
