
-- Diário de Campo main table
CREATE TABLE public.diarios_campo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao_servico TEXT,
  equipe_campo TEXT,
  clima TEXT,
  uf TEXT,
  municipio TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, data)
);

ALTER TABLE public.diarios_campo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View diarios_campo" ON public.diarios_campo
  FOR SELECT TO authenticated
  USING (user_can_access_site(auth.uid(), site_id));

CREATE POLICY "Insert diarios_campo" ON public.diarios_campo
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_site(auth.uid(), site_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Update diarios_campo" ON public.diarios_campo
  FOR UPDATE TO authenticated
  USING (user_can_access_site(auth.uid(), site_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Delete diarios_campo" ON public.diarios_campo
  FOR DELETE TO authenticated
  USING (user_can_access_site(auth.uid(), site_id) AND has_role(auth.uid(), 'admin'::app_role));

-- Diário de Campo photos table
CREATE TABLE public.diario_campo_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diario_campo_id UUID NOT NULL REFERENCES public.diarios_campo(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  legenda TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.diario_campo_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View diario_campo_fotos" ON public.diario_campo_fotos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diarios_campo dc WHERE dc.id = diario_campo_fotos.diario_campo_id
    AND user_can_access_site(auth.uid(), dc.site_id)
  ));

CREATE POLICY "Insert diario_campo_fotos" ON public.diario_campo_fotos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.diarios_campo dc WHERE dc.id = diario_campo_fotos.diario_campo_id
    AND user_can_access_site(auth.uid(), dc.site_id) AND get_user_role(auth.uid()) <> 'cliente'
  ));

CREATE POLICY "Delete diario_campo_fotos" ON public.diario_campo_fotos
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diarios_campo dc WHERE dc.id = diario_campo_fotos.diario_campo_id
    AND user_can_access_site(auth.uid(), dc.site_id) AND get_user_role(auth.uid()) <> 'cliente'
  ));

-- Trigger for updated_at
CREATE TRIGGER update_diarios_campo_updated_at
  BEFORE UPDATE ON public.diarios_campo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
