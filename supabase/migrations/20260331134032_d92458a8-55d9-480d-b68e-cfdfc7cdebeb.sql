
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projetos_area_id ON public.projetos(area_id);
