
-- Add status column to recursos table
ALTER TABLE public.recursos ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'livre';

-- Create recurso_alocacoes table
CREATE TABLE public.recurso_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id uuid NOT NULL REFERENCES public.recursos(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurso_alocacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies for recurso_alocacoes
CREATE POLICY "View recurso_alocacoes" ON public.recurso_alocacoes
  FOR SELECT TO authenticated
  USING (
    recurso_id IN (SELECT id FROM public.recursos WHERE empresa_id = public.get_user_empresa_id(auth.uid()))
  );

CREATE POLICY "Manage recurso_alocacoes" ON public.recurso_alocacoes
  FOR ALL TO authenticated
  USING (
    recurso_id IN (SELECT id FROM public.recursos WHERE empresa_id = public.get_user_empresa_id(auth.uid()))
    AND public.get_user_role(auth.uid()) <> 'cliente'
  )
  WITH CHECK (
    recurso_id IN (SELECT id FROM public.recursos WHERE empresa_id = public.get_user_empresa_id(auth.uid()))
    AND public.get_user_role(auth.uid()) <> 'cliente'
  );
