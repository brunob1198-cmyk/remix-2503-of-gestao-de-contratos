
CREATE TABLE public.contaazul_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id)
);

ALTER TABLE public.contaazul_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their empresa tokens"
ON public.contaazul_tokens
FOR SELECT
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can insert their empresa tokens"
ON public.contaazul_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update their empresa tokens"
ON public.contaazul_tokens
FOR UPDATE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete their empresa tokens"
ON public.contaazul_tokens
FOR DELETE
TO authenticated
USING (
  empresa_id = public.get_user_empresa_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_contaazul_tokens_updated_at
BEFORE UPDATE ON public.contaazul_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
