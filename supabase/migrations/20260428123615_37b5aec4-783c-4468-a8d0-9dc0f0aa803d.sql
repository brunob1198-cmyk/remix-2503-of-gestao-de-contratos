CREATE TABLE IF NOT EXISTS public.foto_geolocalizacao_ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foto_id UUID NOT NULL REFERENCES public.diario_fotos(id) ON DELETE CASCADE UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.foto_geolocalizacao_ajustes ENABLE ROW LEVEL SECURITY;

-- Simple policies (adjust as needed based on app's auth structure)
CREATE POLICY "Qualquer usuario pode ver ajustes" 
ON public.foto_geolocalizacao_ajustes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Qualquer usuario pode inserir/atualizar ajustes" 
ON public.foto_geolocalizacao_ajustes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Qualquer usuario pode atualizar ajustes" 
ON public.foto_geolocalizacao_ajustes FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_foto_geolocalizacao_ajustes_updated_at
    BEFORE UPDATE ON public.foto_geolocalizacao_ajustes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();