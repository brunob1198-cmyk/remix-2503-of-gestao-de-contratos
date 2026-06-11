ALTER TABLE public.fornecedores 
ADD COLUMN IF NOT EXISTS municipio TEXT,
ADD COLUMN IF NOT EXISTS uf TEXT;

-- O score já existe como NUMERIC, mas vamos garantir que ele tenha um valor padrão se necessário ou apenas confirmar sua existência.
-- Se já existe, não fazemos nada. Se não existisse, adicionaríamos.
