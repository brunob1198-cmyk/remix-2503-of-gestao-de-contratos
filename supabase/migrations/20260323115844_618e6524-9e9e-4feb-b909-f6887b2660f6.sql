
-- Create municipios_ibge table
CREATE TABLE public.municipios_ibge (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ibge text NOT NULL UNIQUE,
  nome text NOT NULL,
  uf text NOT NULL,
  latitude numeric,
  longitude numeric
);

-- Enable RLS (public read for all authenticated users)
ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read municipios" ON public.municipios_ibge
  FOR SELECT TO authenticated
  USING (true);

-- Add location columns to lancamentos_producao
ALTER TABLE public.lancamentos_producao
  ADD COLUMN uf text,
  ADD COLUMN municipio text;

-- Add municipio column to diarios_obra (already has a concept via site but we need explicit)
ALTER TABLE public.diarios_obra
  ADD COLUMN uf text,
  ADD COLUMN municipio text;
