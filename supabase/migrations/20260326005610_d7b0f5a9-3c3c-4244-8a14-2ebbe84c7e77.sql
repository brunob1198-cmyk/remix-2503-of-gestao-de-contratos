
-- Frentes de obra
CREATE TABLE public.frentes_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  data_inicio date,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frentes_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View frentes_obra" ON public.frentes_obra
  FOR SELECT TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Insert frentes_obra" ON public.frentes_obra
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Update frentes_obra" ON public.frentes_obra
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Delete frentes_obra" ON public.frentes_obra
  FOR DELETE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id) AND has_role(auth.uid(), 'admin'));

-- Atividades de planejamento
CREATE TABLE public.atividades_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frente_id uuid NOT NULL REFERENCES public.frentes_obra(id) ON DELETE CASCADE,
  item_lpu_id uuid REFERENCES public.itens_lpu(id),
  nome text NOT NULL,
  quantidade_total numeric NOT NULL DEFAULT 0,
  producao_diaria_prevista numeric NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim_prevista date,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atividades_planejamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View atividades_planejamento" ON public.atividades_planejamento
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes_obra f
    WHERE f.id = frente_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ));

CREATE POLICY "Insert atividades_planejamento" ON public.atividades_planejamento
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.frentes_obra f
    WHERE f.id = frente_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Update atividades_planejamento" ON public.atividades_planejamento
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes_obra f
    WHERE f.id = frente_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ) AND get_user_role(auth.uid()) <> 'cliente');

CREATE POLICY "Delete atividades_planejamento" ON public.atividades_planejamento
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes_obra f
    WHERE f.id = frente_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ) AND has_role(auth.uid(), 'admin'));

-- Dependências entre atividades
CREATE TABLE public.dependencias_atividade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades_planejamento(id) ON DELETE CASCADE,
  predecessora_id uuid NOT NULL REFERENCES public.atividades_planejamento(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(atividade_id, predecessora_id)
);

ALTER TABLE public.dependencias_atividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View dependencias" ON public.dependencias_atividade
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.atividades_planejamento a
    JOIN public.frentes_obra f ON f.id = a.frente_id
    WHERE a.id = atividade_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ));

CREATE POLICY "Manage dependencias" ON public.dependencias_atividade
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.atividades_planejamento a
    JOIN public.frentes_obra f ON f.id = a.frente_id
    WHERE a.id = atividade_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ) AND get_user_role(auth.uid()) <> 'cliente');

-- Associação recurso-atividade
CREATE TABLE public.atividade_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades_planejamento(id) ON DELETE CASCADE,
  recurso_id uuid NOT NULL REFERENCES public.recursos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(atividade_id, recurso_id)
);

ALTER TABLE public.atividade_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View atividade_recursos" ON public.atividade_recursos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.atividades_planejamento a
    JOIN public.frentes_obra f ON f.id = a.frente_id
    WHERE a.id = atividade_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ));

CREATE POLICY "Manage atividade_recursos" ON public.atividade_recursos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.atividades_planejamento a
    JOIN public.frentes_obra f ON f.id = a.frente_id
    WHERE a.id = atividade_id AND user_can_access_projeto(auth.uid(), f.projeto_id)
  ) AND get_user_role(auth.uid()) <> 'cliente');
