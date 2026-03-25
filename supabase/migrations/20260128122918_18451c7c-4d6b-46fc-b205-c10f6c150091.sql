-- Tabela de Projetos
CREATE TABLE public.projetos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    coordenador VARCHAR(255),
    cliente VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Sites (vinculados a projetos)
CREATE TABLE public.sites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    municipio VARCHAR(255),
    uf VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(projeto_id, codigo)
);

-- Tabela de Lista de Preços Unitária (LPU)
CREATE TABLE public.itens_lpu (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    unidade VARCHAR(20) NOT NULL DEFAULT 'UNIT',
    preco_unitario DECIMAL(15, 4) NOT NULL DEFAULT 0,
    categoria VARCHAR(100),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Lançamentos de Produção
CREATE TABLE public.lancamentos_producao (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
    item_lpu_id UUID REFERENCES public.itens_lpu(id) ON DELETE RESTRICT NOT NULL,
    data_producao DATE NOT NULL,
    quantidade DECIMAL(15, 4) NOT NULL,
    empresa_executora VARCHAR(255),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Lançamentos de Medição (aprovadas pelo cliente)
CREATE TABLE public.lancamentos_medicao (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
    item_lpu_id UUID REFERENCES public.itens_lpu(id) ON DELETE RESTRICT NOT NULL,
    data_medicao DATE NOT NULL,
    quantidade DECIMAL(15, 4) NOT NULL,
    numero_medicao VARCHAR(100),
    status VARCHAR(50) DEFAULT 'aprovado',
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Lançamentos de Faturamento
CREATE TABLE public.lancamentos_faturamento (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
    item_lpu_id UUID REFERENCES public.itens_lpu(id) ON DELETE RESTRICT NOT NULL,
    data_faturamento DATE NOT NULL,
    quantidade DECIMAL(15, 4) NOT NULL,
    numero_nf VARCHAR(100),
    valor_faturado DECIMAL(15, 2),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (acesso público)
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_lpu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_faturamento ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (leitura e escrita para todos)
CREATE POLICY "Acesso público projetos" ON public.projetos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público sites" ON public.sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público itens_lpu" ON public.itens_lpu FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público lancamentos_producao" ON public.lancamentos_producao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público lancamentos_medicao" ON public.lancamentos_medicao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público lancamentos_faturamento" ON public.lancamentos_faturamento FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projetos_updated_at BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_itens_lpu_updated_at BEFORE UPDATE ON public.itens_lpu FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lancamentos_producao_updated_at BEFORE UPDATE ON public.lancamentos_producao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lancamentos_medicao_updated_at BEFORE UPDATE ON public.lancamentos_medicao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lancamentos_faturamento_updated_at BEFORE UPDATE ON public.lancamentos_faturamento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_sites_projeto ON public.sites(projeto_id);
CREATE INDEX idx_lancamentos_producao_site ON public.lancamentos_producao(site_id);
CREATE INDEX idx_lancamentos_producao_item ON public.lancamentos_producao(item_lpu_id);
CREATE INDEX idx_lancamentos_medicao_site ON public.lancamentos_medicao(site_id);
CREATE INDEX idx_lancamentos_medicao_item ON public.lancamentos_medicao(item_lpu_id);
CREATE INDEX idx_lancamentos_faturamento_site ON public.lancamentos_faturamento(site_id);
CREATE INDEX idx_lancamentos_faturamento_item ON public.lancamentos_faturamento(item_lpu_id);