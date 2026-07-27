
CREATE TABLE IF NOT EXISTS public.sc_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  entidade_tipo text NOT NULL CHECK (entidade_tipo IN ('requisicao','cotacao','pedido')),
  entidade_id uuid NOT NULL,
  status_anterior text,
  status_novo text,
  usuario_id uuid REFERENCES auth.users(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sc_historico_entidade
  ON public.sc_historico(entidade_tipo, entidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_historico_empresa
  ON public.sc_historico(empresa_id);

GRANT SELECT, INSERT ON public.sc_historico TO authenticated;
GRANT ALL ON public.sc_historico TO service_role;

ALTER TABLE public.sc_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_historico select empresa scoped"
  ON public.sc_historico FOR SELECT
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

CREATE POLICY "sc_historico insert empresa scoped"
  ON public.sc_historico FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
