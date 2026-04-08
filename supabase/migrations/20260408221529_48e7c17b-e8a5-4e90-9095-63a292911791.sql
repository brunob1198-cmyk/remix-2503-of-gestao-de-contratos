ALTER TABLE public.diarios_campo ALTER COLUMN site_id DROP NOT NULL;
ALTER TABLE public.diarios_campo ADD COLUMN projeto_id uuid REFERENCES public.projetos(id);
