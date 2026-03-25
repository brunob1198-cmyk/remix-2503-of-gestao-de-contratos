
-- Add quantidade_pendente to lancamentos_medicao
ALTER TABLE public.lancamentos_medicao ADD COLUMN IF NOT EXISTS quantidade_pendente numeric DEFAULT 0;

-- Create status history table for tracking all status/date changes
CREATE TABLE public.medicao_status_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  numero_medicao text,
  status_anterior text,
  status_novo text NOT NULL,
  data_mudanca timestamp with time zone DEFAULT now(),
  observacao text,
  PRIMARY KEY (id)
);

ALTER TABLE public.medicao_status_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage medicao status history"
ON public.medicao_status_historico
FOR ALL TO authenticated
USING (user_can_access_site(auth.uid(), site_id))
WITH CHECK (user_can_access_site(auth.uid(), site_id));
