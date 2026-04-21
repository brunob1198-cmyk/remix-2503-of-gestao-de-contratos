-- Adiciona colunas para melhor rastreio e controle de duplicidade
ALTER TABLE public.flash_integration_logs 
ADD COLUMN IF NOT EXISTS flash_transaction_id UUID,
ADD COLUMN IF NOT EXISTS conta_azul_transaction_id TEXT;

-- Cria um índice para otimizar a verificação de duplicidade
CREATE INDEX IF NOT EXISTS idx_flash_integration_logs_flash_id ON public.flash_integration_logs(flash_transaction_id);

-- Comentários para documentação
COMMENT ON COLUMN public.flash_integration_logs.flash_transaction_id IS 'ID da transação original na Flash (referência flash_transactions_raw)';
COMMENT ON COLUMN public.flash_integration_logs.conta_azul_transaction_id IS 'ID da transação criada no Conta Azul após o envio';