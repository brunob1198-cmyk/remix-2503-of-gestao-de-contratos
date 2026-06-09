-- Add workflow_status column to requisicoes_compra
ALTER TABLE public.requisicoes_compra 
ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'DRAFT'
CHECK (workflow_status IN (
    'DRAFT', 'SUBMITTED', 'QUOTING', 'QUOTE_COMPLETED', 'PENDING_APPROVAL', 
    'APPROVED', 'REJECTED', 'PURCHASE_ORDER_CREATED', 'PURCHASED', 
    'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'
));

-- Create historico table for workflow tracking
CREATE TABLE IF NOT EXISTS public.requisicao_historico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requisicao_id UUID NOT NULL REFERENCES public.requisicoes_compra(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_historico TO authenticated;
GRANT ALL ON public.requisicao_historico TO service_role;

-- Enable RLS
ALTER TABLE public.requisicao_historico ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view history of accessible requisitions" ON public.requisicao_historico
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.requisicoes_compra r
            WHERE r.id = requisicao_historico.requisicao_id
        )
    );

CREATE POLICY "Users can insert history for accessible requisitions" ON public.requisicao_historico
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.requisicoes_compra r
            WHERE r.id = requisicao_historico.requisicao_id
        )
    );

-- Trigger to automatically log status changes
CREATE OR REPLACE FUNCTION public.log_requisicao_workflow_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.workflow_status IS DISTINCT FROM NEW.workflow_status) THEN
        INSERT INTO public.requisicao_historico (
            requisicao_id,
            status_anterior,
            status_novo,
            usuario_id
        ) VALUES (
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.workflow_status ELSE NULL END,
            NEW.workflow_status,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_requisicao_workflow_history
AFTER INSERT OR UPDATE OF workflow_status ON public.requisicoes_compra
FOR EACH ROW EXECUTE FUNCTION public.log_requisicao_workflow_change();

-- Initialize workflow_status based on existing status
UPDATE public.requisicoes_compra
SET workflow_status = CASE 
    WHEN status = 'rascunho' THEN 'DRAFT'
    WHEN status = 'aprovada' THEN 'APPROVED'
    WHEN status = 'em_cotacao' THEN 'QUOTING'
    WHEN status = 'finalizada' THEN 'CLOSED'
    WHEN status = 'cancelada' THEN 'REJECTED'
    ELSE 'SUBMITTED'
END
WHERE workflow_status = 'DRAFT';
