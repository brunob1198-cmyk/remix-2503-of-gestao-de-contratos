
-- Timeline eventos table
CREATE TABLE public.timeline_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'producao',
  item text,
  quantidade numeric DEFAULT 0,
  equipe_id uuid REFERENCES public.recursos(id) ON DELETE SET NULL,
  latitude numeric,
  longitude numeric,
  imagem_url text,
  status text DEFAULT 'ok',
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View timeline_eventos" ON public.timeline_eventos
  FOR SELECT TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Insert timeline_eventos" ON public.timeline_eventos
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Update timeline_eventos" ON public.timeline_eventos
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Delete timeline_eventos" ON public.timeline_eventos
  FOR DELETE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id) AND has_role(auth.uid(), 'admin'::app_role));
