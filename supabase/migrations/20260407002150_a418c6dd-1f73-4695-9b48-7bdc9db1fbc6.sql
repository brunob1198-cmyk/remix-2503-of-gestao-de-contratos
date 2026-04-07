
-- Fornecedores
CREATE TABLE public.fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  razao_social text NOT NULL,
  cnpj text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  endereco text,
  categoria text DEFAULT 'geral',
  avaliacao integer DEFAULT 0,
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View fornecedores" ON public.fornecedores FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens padronizados de suprimentos
CREATE TABLE public.sc_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'UN',
  categoria text,
  especificacao text,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sc_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sc_itens" ON public.sc_itens FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert sc_itens" ON public.sc_itens FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update sc_itens" ON public.sc_itens FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete sc_itens" ON public.sc_itens FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sc_itens_updated_at BEFORE UPDATE ON public.sc_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Locais de estoque
CREATE TABLE public.sc_locais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'almoxarifado',
  projeto_id uuid REFERENCES public.projetos(id),
  site_id uuid REFERENCES public.sites(id),
  endereco text,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sc_locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View sc_locais" ON public.sc_locais FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert sc_locais" ON public.sc_locais FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update sc_locais" ON public.sc_locais FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete sc_locais" ON public.sc_locais FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sc_locais_updated_at BEFORE UPDATE ON public.sc_locais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Requisições de Compra
CREATE TABLE public.requisicoes_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  projeto_id uuid REFERENCES public.projetos(id),
  numero text NOT NULL,
  solicitante_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  prioridade text NOT NULL DEFAULT 'normal',
  data_necessidade date,
  justificativa text,
  observacoes text,
  local_entrega_id uuid REFERENCES public.sc_locais(id),
  aprovado_por uuid,
  data_aprovacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requisicoes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View requisicoes_compra" ON public.requisicoes_compra FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert requisicoes_compra" ON public.requisicoes_compra FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update requisicoes_compra" ON public.requisicoes_compra FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete requisicoes_compra" ON public.requisicoes_compra FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_requisicoes_compra_updated_at BEFORE UPDATE ON public.requisicoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens da Requisição
CREATE TABLE public.requisicao_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes_compra(id) ON DELETE CASCADE,
  sc_item_id uuid REFERENCES public.sc_itens(id),
  descricao_livre text,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'UN',
  especificacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View requisicao_itens" ON public.requisicao_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM requisicoes_compra r WHERE r.id = requisicao_itens.requisicao_id AND r.empresa_id = get_user_empresa_id(auth.uid())));
CREATE POLICY "Insert requisicao_itens" ON public.requisicao_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM requisicoes_compra r WHERE r.id = requisicao_itens.requisicao_id AND r.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update requisicao_itens" ON public.requisicao_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM requisicoes_compra r WHERE r.id = requisicao_itens.requisicao_id AND r.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete requisicao_itens" ON public.requisicao_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM requisicoes_compra r WHERE r.id = requisicao_itens.requisicao_id AND r.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');

-- Cotações
CREATE TABLE public.cotacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes_compra(id),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  numero text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  validade date,
  prazo_entrega_dias integer,
  condicao_pagamento text,
  frete numeric DEFAULT 0,
  desconto_percentual numeric DEFAULT 0,
  observacoes text,
  valor_total numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cotacoes" ON public.cotacoes FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert cotacoes" ON public.cotacoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update cotacoes" ON public.cotacoes FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete cotacoes" ON public.cotacoes FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cotacoes_updated_at BEFORE UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens da Cotação
CREATE TABLE public.cotacao_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  requisicao_item_id uuid NOT NULL REFERENCES public.requisicao_itens(id),
  preco_unitario numeric NOT NULL DEFAULT 0,
  quantidade numeric NOT NULL DEFAULT 0,
  prazo_entrega_dias integer,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cotacao_itens" ON public.cotacao_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = cotacao_itens.cotacao_id AND c.empresa_id = get_user_empresa_id(auth.uid())));
CREATE POLICY "Insert cotacao_itens" ON public.cotacao_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = cotacao_itens.cotacao_id AND c.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update cotacao_itens" ON public.cotacao_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = cotacao_itens.cotacao_id AND c.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete cotacao_itens" ON public.cotacao_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = cotacao_itens.cotacao_id AND c.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');

-- Pedidos de Compra
CREATE TABLE public.pedidos_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cotacao_id uuid REFERENCES public.cotacoes(id),
  requisicao_id uuid REFERENCES public.requisicoes_compra(id),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  numero text NOT NULL,
  status text NOT NULL DEFAULT 'emitido',
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_entrega_prevista date,
  condicao_pagamento text,
  valor_total numeric DEFAULT 0,
  frete numeric DEFAULT 0,
  observacoes text,
  aprovado_por uuid,
  data_aprovacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pedidos_compra" ON public.pedidos_compra FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert pedidos_compra" ON public.pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update pedidos_compra" ON public.pedidos_compra FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete pedidos_compra" ON public.pedidos_compra FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pedidos_compra_updated_at BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens do Pedido
CREATE TABLE public.pedido_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  sc_item_id uuid REFERENCES public.sc_itens(id),
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  preco_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'UN',
  quantidade_entregue numeric DEFAULT 0,
  status text DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pedidos_compra p WHERE p.id = pedido_itens.pedido_id AND p.empresa_id = get_user_empresa_id(auth.uid())));
CREATE POLICY "Insert pedido_itens" ON public.pedido_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pedidos_compra p WHERE p.id = pedido_itens.pedido_id AND p.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Update pedido_itens" ON public.pedido_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM pedidos_compra p WHERE p.id = pedido_itens.pedido_id AND p.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
CREATE POLICY "Delete pedido_itens" ON public.pedido_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM pedidos_compra p WHERE p.id = pedido_itens.pedido_id AND p.empresa_id = get_user_empresa_id(auth.uid())) AND get_user_role(auth.uid()) <> 'cliente');
