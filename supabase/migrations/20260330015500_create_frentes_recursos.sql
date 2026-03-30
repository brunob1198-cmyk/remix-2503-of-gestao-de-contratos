-- Tabela de vínculo entre Frentes de Obra e Recursos (Pessoas/Equipamentos)
CREATE TABLE public.frentes_recursos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frente_id uuid NOT NULL REFERENCES public.frentes_obra(id) ON DELETE CASCADE,
  recurso_id uuid NOT NULL REFERENCES public.recursos(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(frente_id, recurso_id)
);

-- Habilitar RLS
ALTER TABLE public.frentes_recursos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para frentes_recursos
CREATE POLICY "public_access" ON public.frentes_recursos FOR ALL TO public USING (true) WITH CHECK (true);
