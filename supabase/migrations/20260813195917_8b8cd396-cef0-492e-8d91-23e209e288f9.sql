CREATE TABLE IF NOT EXISTS public.sgsst_funcoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cbo TEXT,
    descricao TEXT,
    requisitos_minimos TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_funcoes TO authenticated;
GRANT ALL ON public.sgsst_funcoes TO service_role;
ALTER TABLE public.sgsst_funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's funcoes" ON public.sgsst_funcoes FOR SELECT TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert their company's funcoes" ON public.sgsst_funcoes FOR INSERT TO authenticated WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update their company's funcoes" ON public.sgsst_funcoes FOR UPDATE TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete their company's funcoes" ON public.sgsst_funcoes FOR DELETE TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.sgsst_colaborador_dados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recurso_id UUID REFERENCES public.recursos(id) ON DELETE SET NULL,
    funcao_id UUID REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
    area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    matricula TEXT,
    data_admissao DATE,
    data_demissao DATE,
    tipo_vinculo TEXT NOT NULL CHECK (tipo_vinculo IN ('CLT', 'PJ', 'Terceirizado', 'Estagiario', 'Outro')),
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'afastado', 'desligado')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_colaborador_dados TO authenticated;
GRANT ALL ON public.sgsst_colaborador_dados TO service_role;
ALTER TABLE public.sgsst_colaborador_dados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's colaboradores" ON public.sgsst_colaborador_dados FOR SELECT TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert their company's colaboradores" ON public.sgsst_colaborador_dados FOR INSERT TO authenticated WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update their company's colaboradores" ON public.sgsst_colaborador_dados FOR UPDATE TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete their company's colaboradores" ON public.sgsst_colaborador_dados FOR DELETE TO authenticated USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));
