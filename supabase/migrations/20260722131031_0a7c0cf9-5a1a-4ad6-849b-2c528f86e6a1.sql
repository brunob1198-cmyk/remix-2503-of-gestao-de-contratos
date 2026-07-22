-- 1. Adicionar colunas em lancamentos_medicao
ALTER TABLE public.lancamentos_medicao 
ADD COLUMN IF NOT EXISTS mostrar_lpu BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS mostrar_valores_site BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS modo_somente_fotos BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fotos_por_pagina INTEGER DEFAULT 4 CHECK (fotos_por_pagina IN (2, 4, 6)),
ADD COLUMN IF NOT EXISTS legenda_padrao_fotos TEXT;

-- 2. Criar a tabela medicao_report_photo_captions
CREATE TABLE IF NOT EXISTS public.medicao_report_photo_captions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_medicao TEXT NOT NULL,
    foto_id UUID NOT NULL REFERENCES public.diario_fotos(id) ON DELETE CASCADE,
    legenda TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (numero_medicao, foto_id)
);

-- Grants para medicao_report_photo_captions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicao_report_photo_captions TO authenticated;
GRANT ALL ON public.medicao_report_photo_captions TO service_role;

-- RLS para medicao_report_photo_captions
ALTER TABLE public.medicao_report_photo_captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage photo captions"
ON public.medicao_report_photo_captions
FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

-- 3. Criar report_templates
CREATE TABLE IF NOT EXISTS public.report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo_medicao TEXT CHECK (tipo_medicao IN ('separada', 'agrupada', 'mista')),
    mostrar_lpu BOOLEAN DEFAULT TRUE,
    mostrar_valores_site BOOLEAN DEFAULT TRUE,
    modo_somente_fotos BOOLEAN DEFAULT FALSE,
    fotos_por_pagina INTEGER DEFAULT 4,
    legenda_padrao_fotos TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grants para report_templates
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;

-- RLS para report_templates
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage report templates"
ON public.report_templates
FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);
