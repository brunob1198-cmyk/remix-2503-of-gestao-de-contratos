
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(nome, empresa_id)
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View areas same empresa" ON public.areas
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Manage areas" ON public.areas
  FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente')
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
