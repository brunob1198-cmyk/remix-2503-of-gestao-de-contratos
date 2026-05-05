-- Adicionar colunas de thumbnail na tabela diario_fotos
ALTER TABLE public.diario_fotos 
ADD COLUMN IF NOT EXISTS thumb_url TEXT;

-- Adicionar colunas de thumbnail na tabela diario_campo_fotos
ALTER TABLE public.diario_campo_fotos 
ADD COLUMN IF NOT EXISTS thumb_url TEXT;

-- Adicionar colunas de thumbnail na tabela timeline_eventos
ALTER TABLE public.timeline_eventos 
ADD COLUMN IF NOT EXISTS imagem_thumb_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.diario_fotos.thumb_url IS 'URL da versão reduzida (thumbnail) da imagem para economia de banda.';
COMMENT ON COLUMN public.diario_campo_fotos.thumb_url IS 'URL da versão reduzida (thumbnail) da imagem para economia de banda.';
COMMENT ON COLUMN public.timeline_eventos.imagem_thumb_url IS 'URL da versão reduzida (thumbnail) da imagem para economia de banda.';
