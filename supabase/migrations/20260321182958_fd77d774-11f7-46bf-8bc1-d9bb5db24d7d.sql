
-- ERP Integration config (per empresa)
CREATE TABLE public.integracoes_erp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'ERP Principal',
  webhook_url text NOT NULL,
  auth_token text,
  auth_type text NOT NULL DEFAULT 'bearer',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, nome)
);
ALTER TABLE public.integracoes_erp_config ENABLE ROW LEVEL SECURITY;

-- ERP Integration log
CREATE TABLE public.integracoes_erp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.integracoes_erp_config(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  evento text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  resposta jsonb,
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.integracoes_erp_log ENABLE ROW LEVEL SECURITY;

-- RLS for config
CREATE POLICY "View own empresa config" ON public.integracoes_erp_config FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Admin manage config" ON public.integracoes_erp_config FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update config" ON public.integracoes_erp_config FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete config" ON public.integracoes_erp_config FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- RLS for log
CREATE POLICY "View own empresa logs" ON public.integracoes_erp_log FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Insert logs" ON public.integracoes_erp_log FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Update logs" ON public.integracoes_erp_log FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.get_user_role(auth.uid()) != 'cliente');
