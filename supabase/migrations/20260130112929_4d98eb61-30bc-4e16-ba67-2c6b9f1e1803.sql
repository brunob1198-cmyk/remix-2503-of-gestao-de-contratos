-- Add projeto_id to itens_lpu to allow different LPUs per project
ALTER TABLE public.itens_lpu ADD COLUMN projeto_id uuid REFERENCES public.projetos(id);

-- Create index for better performance
CREATE INDEX idx_itens_lpu_projeto ON public.itens_lpu(projeto_id);

-- Add numero_po and observacao_acompanhamento to lancamentos_medicao
ALTER TABLE public.lancamentos_medicao ADD COLUMN numero_po character varying;
ALTER TABLE public.lancamentos_medicao ADD COLUMN observacao_acompanhamento text;

-- Add numero_po to lancamentos_faturamento
ALTER TABLE public.lancamentos_faturamento ADD COLUMN numero_po character varying;