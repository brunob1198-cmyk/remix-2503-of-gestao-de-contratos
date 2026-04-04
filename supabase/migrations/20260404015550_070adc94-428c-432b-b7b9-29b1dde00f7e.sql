
-- Tabela de custos reais importados do ERP
CREATE TABLE IF NOT EXISTS public.custo_real_erp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_id text UNIQUE NOT NULL,
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  data_competencia date,
  data_pagamento date,
  status_erp text NOT NULL DEFAULT 'pendente',
  categoria_erp text NOT NULL DEFAULT 'Outros',
  categoria_interna text NOT NULL DEFAULT 'Indiretos',
  centro_custo text,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de mapeamento de categorias ERP → internas
CREATE TABLE IF NOT EXISTS public.mapeamento_categorias_erp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_erp text UNIQUE NOT NULL,
  categoria_interna text NOT NULL DEFAULT 'Indiretos',
  criado_por_ia boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.custo_real_erp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapeamento_categorias_erp ENABLE ROW LEVEL SECURITY;

-- Policies para custo_real_erp (acesso por projeto da empresa)
CREATE POLICY "Users can view costs of their projects"
  ON public.custo_real_erp FOR SELECT TO authenticated
  USING (
    projeto_id IS NULL 
    OR public.user_can_access_projeto(auth.uid(), projeto_id)
  );

CREATE POLICY "Service role full access custo_real_erp"
  ON public.custo_real_erp FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Policies para mapeamento_categorias_erp (admin pode gerenciar)
CREATE POLICY "Authenticated can view mappings"
  ON public.mapeamento_categorias_erp FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access mapeamento"
  ON public.mapeamento_categorias_erp FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_custo_real_erp_updated_at
  BEFORE UPDATE ON public.custo_real_erp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
