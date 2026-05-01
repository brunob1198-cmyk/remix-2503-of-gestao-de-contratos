-- Tabela para armazenar o histórico de exportações de PDF vinculadas a lancamentos_medicao
CREATE TABLE IF NOT EXISTS public.medicao_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicao_id UUID NOT NULL REFERENCES public.lancamentos_medicao(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size BIGINT,
    quality TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.medicao_exports ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view exports for their medicoes"
    ON public.medicao_exports
    FOR SELECT
    USING (true); -- Permitir visualização (ajustar conforme necessidade de privacidade específica)

CREATE POLICY "Users can insert exports"
    ON public.medicao_exports
    FOR INSERT
    WITH CHECK (true);

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_medicao_exports_medicao_id ON public.medicao_exports(medicao_id);
