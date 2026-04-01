ALTER TABLE public.diario_veiculos 
  ADD COLUMN IF NOT EXISTS km_inicial numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS km_final numeric DEFAULT 0;