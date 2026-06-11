-- Adiciona campos de CEP e Complemento à tabela de fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS complemento TEXT;

-- Atualiza permissões (embora já devam estar herdadas, é bom garantir)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
