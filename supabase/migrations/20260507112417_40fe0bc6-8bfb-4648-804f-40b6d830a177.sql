-- Create FCA events table
CREATE TABLE IF NOT EXISTS public.fca_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL, -- Format: YYYY-MM
    fato TEXT NOT NULL,
    causa TEXT NOT NULL,
    acao TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.fca_eventos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "FCA eventos are viewable by everyone" 
ON public.fca_eventos FOR SELECT 
USING (true);

CREATE POLICY "Users can insert FCA eventos" 
ON public.fca_eventos FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own FCA eventos" 
ON public.fca_eventos FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own FCA eventos" 
ON public.fca_eventos FOR DELETE 
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fca_updated_at
    BEFORE UPDATE ON public.fca_eventos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();