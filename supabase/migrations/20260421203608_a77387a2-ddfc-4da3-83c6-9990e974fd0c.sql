-- Tabela de mapeamento reutilizável (tipo Flash → Categoria/Conta Conta Azul)
CREATE TABLE public.flash_category_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  flash_type text NOT NULL,
  conta_azul_category_id text,
  conta_azul_category_name text,
  conta_azul_account_id text,
  conta_azul_account_name text,
  tipo_operacao text NOT NULL DEFAULT 'despesa' CHECK (tipo_operacao IN ('receita', 'despesa')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, flash_type)
);

ALTER TABLE public.flash_category_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view flash_category_mapping"
  ON public.flash_category_mapping FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert flash_category_mapping"
  ON public.flash_category_mapping FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update flash_category_mapping"
  ON public.flash_category_mapping FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete flash_category_mapping"
  ON public.flash_category_mapping FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_flash_category_mapping_updated_at
  BEFORE UPDATE ON public.flash_category_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de normalização por lançamento
CREATE TABLE public.flash_normalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  flash_transaction_id uuid NOT NULL REFERENCES public.flash_transactions_raw(id) ON DELETE CASCADE,
  conta_azul_category_id text,
  conta_azul_category_name text,
  conta_azul_account_id text,
  conta_azul_account_name text,
  tipo_operacao text NOT NULL DEFAULT 'despesa' CHECK (tipo_operacao IN ('receita', 'despesa')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'normalizado', 'enviado')),
  observacao text,
  normalizado_at timestamp with time zone,
  enviado_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (flash_transaction_id)
);

ALTER TABLE public.flash_normalizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view flash_normalizacao"
  ON public.flash_normalizacao FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert flash_normalizacao"
  ON public.flash_normalizacao FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update flash_normalizacao"
  ON public.flash_normalizacao FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete flash_normalizacao"
  ON public.flash_normalizacao FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_flash_normalizacao_updated_at
  BEFORE UPDATE ON public.flash_normalizacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_flash_normalizacao_empresa ON public.flash_normalizacao(empresa_id, status);
CREATE INDEX idx_flash_category_mapping_empresa_type ON public.flash_category_mapping(empresa_id, flash_type);