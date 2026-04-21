-- Tabela para armazenar transações brutas da Flash
CREATE TABLE public.flash_transactions_raw (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, external_id)
);

CREATE INDEX idx_flash_transactions_raw_empresa ON public.flash_transactions_raw(empresa_id);
CREATE INDEX idx_flash_transactions_raw_external_id ON public.flash_transactions_raw(external_id);
CREATE INDEX idx_flash_transactions_raw_created_at ON public.flash_transactions_raw(created_at DESC);

ALTER TABLE public.flash_transactions_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view flash_transactions_raw"
ON public.flash_transactions_raw
FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete flash_transactions_raw"
ON public.flash_transactions_raw
FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- INSERTs feitos pela edge function via service role (bypass RLS)

-- Tabela para logs da integração Flash
CREATE TABLE public.flash_integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  evento TEXT NOT NULL DEFAULT 'getTransactions',
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  http_status INTEGER,
  duracao_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_flash_integration_logs_empresa ON public.flash_integration_logs(empresa_id);
CREATE INDEX idx_flash_integration_logs_created_at ON public.flash_integration_logs(created_at DESC);
CREATE INDEX idx_flash_integration_logs_status ON public.flash_integration_logs(status);

ALTER TABLE public.flash_integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view flash_integration_logs"
ON public.flash_integration_logs
FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));