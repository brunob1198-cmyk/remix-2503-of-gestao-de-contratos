
CREATE TABLE public.analises_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  resultado jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View analises_ia" ON public.analises_ia
  FOR SELECT TO authenticated
  USING (user_can_access_site(auth.uid(), site_id));

CREATE POLICY "Insert analises_ia" ON public.analises_ia
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_site(auth.uid(), site_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Delete analises_ia" ON public.analises_ia
  FOR DELETE TO authenticated
  USING (user_can_access_site(auth.uid(), site_id) AND has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_analises_ia_site_id ON public.analises_ia(site_id, created_at DESC);
