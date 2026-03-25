
ALTER TABLE public.diario_fotos 
ADD COLUMN diario_producao_id uuid REFERENCES public.diario_producao(id) ON DELETE SET NULL;
