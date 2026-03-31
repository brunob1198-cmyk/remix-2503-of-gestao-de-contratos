-- Criação das tabelas de Custos ERP e Orçamento
CREATE TABLE IF NOT EXISTS public.orcamento_projetos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    mes_referencia DATE NOT NULL, -- Primeiro dia do mês (ex: 2026-03-01)
    mao_de_obra NUMERIC(14,2) DEFAULT 0,
    materiais NUMERIC(14,2) DEFAULT 0,
    equipamentos NUMERIC(14,2) DEFAULT 0,
    transporte NUMERIC(14,2) DEFAULT 0,
    indiretos NUMERIC(14,2) DEFAULT 0,
    financeiros NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(projeto_id, site_id, mes_referencia)
);

CREATE TABLE IF NOT EXISTS public.custo_real_erp (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    erp_id TEXT UNIQUE NOT NULL, -- ID original do Conta Azul
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    centro_custo TEXT, -- Centro de Custo no Conta Azul
    descricao TEXT NOT NULL,
    valor NUMERIC(14,2) NOT NULL,
    data_competencia DATE,
    data_pagamento DATE,
    status_erp TEXT, -- Pago, Pendente
    categoria_erp TEXT,
    categoria_interna TEXT, -- mapeamento: Mão de Obra, Materiais, Equipamentos, Transporte, Indiretos, Financeiros, Outros
    fornecedor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mapeamento_categorias_erp (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    categoria_erp TEXT UNIQUE NOT NULL,
    categoria_interna TEXT NOT NULL,
    criado_por_ia BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativação de RLS e Policies para orcamento_projetos
ALTER TABLE public.orcamento_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on orcamento_projetos"
ON public.orcamento_projetos FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable all modifications for authenticated users on orcamento_projetos"
ON public.orcamento_projetos FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Ativação de RLS e Policies para custo_real_erp
ALTER TABLE public.custo_real_erp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on custo_real_erp"
ON public.custo_real_erp FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable all modifications for authenticated users on custo_real_erp"
ON public.custo_real_erp FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Ativação de RLS e Policies para mapeamento_categorias_erp
ALTER TABLE public.mapeamento_categorias_erp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on mapeamento_categorias_erp"
ON public.mapeamento_categorias_erp FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable all modifications for authenticated users on mapeamento_categorias_erp"
ON public.mapeamento_categorias_erp FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Functions and Triggers for updated_at
CREATE TRIGGER set_timestamp_orcamento_projetos
BEFORE UPDATE ON public.orcamento_projetos
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_custo_real_erp
BEFORE UPDATE ON public.custo_real_erp
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_mapeamento_categorias_erp
BEFORE UPDATE ON public.mapeamento_categorias_erp
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
