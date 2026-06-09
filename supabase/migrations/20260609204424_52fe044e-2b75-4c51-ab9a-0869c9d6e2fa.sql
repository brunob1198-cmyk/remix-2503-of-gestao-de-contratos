-- Permissões por etapa do workflow de compras
-- Adicionando colunas de permissão na tabela profiles para facilitar (ou poderíamos usar uma tabela dedicada, mas profiles é prático para o contexto atual)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pode_aprovar_compra BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pode_rejeitar_compra BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pode_receber_compra BOOLEAN DEFAULT false;

-- Garantir que a tabela de notificações existe (caso não exista por outros módulos)
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    link TEXT,
    tipo TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications" ON public.notificacoes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger para notificações de workflow em requisições de compra
CREATE OR REPLACE FUNCTION public.notify_requisicao_workflow_change()
RETURNS TRIGGER AS $$
DECLARE
    solicitante_id UUID;
    empresa_id UUID;
    titulo TEXT;
    mensagem TEXT;
    v_numero TEXT;
BEGIN
    IF (OLD.workflow_status IS DISTINCT FROM NEW.workflow_status) THEN
        solicitante_id := NEW.solicitante_id;
        empresa_id := NEW.empresa_id;
        v_numero := NEW.numero;
        
        titulo := 'Atualização na Requisição ' || v_numero;
        mensagem := 'O status da requisição ' || v_numero || ' foi alterado de ' || COALESCE(OLD.workflow_status, 'N/A') || ' para ' || NEW.workflow_status || '.';

        -- Notificar o solicitante
        INSERT INTO public.notificacoes (user_id, empresa_id, titulo, mensagem, tipo, link)
        VALUES (solicitante_id, empresa_id, titulo, mensagem, 'info', '/supply-chain');

        -- Se for PENDING_APPROVAL, notificar quem tem permissão de aprovação
        IF NEW.workflow_status = 'PENDING_APPROVAL' THEN
            INSERT INTO public.notificacoes (user_id, empresa_id, titulo, mensagem, tipo, link)
            SELECT id, NEW.empresa_id, 'Aprovação Pendente: ' || v_numero, 'Uma nova requisição aguarda sua aprovação.', 'warning', '/supply-chain'
            FROM public.profiles
            WHERE empresa_id = NEW.empresa_id AND pode_aprovar_compra = true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_requisicao_workflow ON public.requisicoes_compra;
CREATE TRIGGER tr_notify_requisicao_workflow
AFTER UPDATE ON public.requisicoes_compra
FOR EACH ROW EXECUTE FUNCTION public.notify_requisicao_workflow_change();
