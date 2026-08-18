CREATE TABLE public.sgsst_epis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  codigo TEXT,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  fabricante TEXT,
  modelo TEXT,
  ca TEXT NOT NULL,
  validade_ca DATE,
  unidade_medida TEXT NOT NULL DEFAULT 'UN',
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  descricao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_epis TO authenticated;
GRANT ALL ON public.sgsst_epis TO service_role;
ALTER TABLE public.sgsst_epis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epis_tenant_all" ON public.sgsst_epis FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE INDEX idx_sgsst_epis_empresa ON public.sgsst_epis(empresa_id);
CREATE TRIGGER update_sgsst_epis_updated_at BEFORE UPDATE ON public.sgsst_epis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sgsst_epi_entregas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  colaborador_id UUID NOT NULL REFERENCES public.sgsst_colaborador_dados(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.sgsst_epis(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  data_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel_entrega_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL DEFAULT 'PRIMEIRA_ENTREGA',
  tamanho_modelo TEXT,
  confirmacao_recebimento BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_epi_entregas TO authenticated;
GRANT ALL ON public.sgsst_epi_entregas TO service_role;
ALTER TABLE public.sgsst_epi_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epi_entregas_tenant_all" ON public.sgsst_epi_entregas FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE INDEX idx_sgsst_epi_entregas_empresa ON public.sgsst_epi_entregas(empresa_id);
CREATE INDEX idx_sgsst_epi_entregas_epi ON public.sgsst_epi_entregas(epi_id);
CREATE INDEX idx_sgsst_epi_entregas_colab ON public.sgsst_epi_entregas(colaborador_id);
CREATE TRIGGER update_sgsst_epi_entregas_updated_at BEFORE UPDATE ON public.sgsst_epi_entregas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sgsst_epi_devolucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  entrega_id UUID NOT NULL REFERENCES public.sgsst_epi_entregas(id) ON DELETE CASCADE,
  quantidade_devolvida NUMERIC NOT NULL DEFAULT 1,
  data_devolucao DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel_devolucao_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo TEXT,
  condicao_epi TEXT NOT NULL DEFAULT 'BOM',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_epi_devolucoes TO authenticated;
GRANT ALL ON public.sgsst_epi_devolucoes TO service_role;
ALTER TABLE public.sgsst_epi_devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epi_devolucoes_tenant_all" ON public.sgsst_epi_devolucoes FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE INDEX idx_sgsst_epi_devolucoes_empresa ON public.sgsst_epi_devolucoes(empresa_id);
CREATE INDEX idx_sgsst_epi_devolucoes_entrega ON public.sgsst_epi_devolucoes(entrega_id);

CREATE TABLE public.sgsst_epi_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  epi_id UUID REFERENCES public.sgsst_epis(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao TEXT NOT NULL,
  quantidade NUMERIC,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgsst_epi_historico TO authenticated;
GRANT ALL ON public.sgsst_epi_historico TO service_role;
ALTER TABLE public.sgsst_epi_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epi_historico_tenant_all" ON public.sgsst_epi_historico FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE INDEX idx_sgsst_epi_historico_empresa ON public.sgsst_epi_historico(empresa_id);
CREATE INDEX idx_sgsst_epi_historico_epi ON public.sgsst_epi_historico(epi_id);
CREATE INDEX idx_sgsst_epi_historico_colab ON public.sgsst_epi_historico(colaborador_id);