ALTER TABLE public.faturamentos_conta_azul
ADD COLUMN IF NOT EXISTS payload_json JSONB;

COMMENT ON COLUMN public.faturamentos_conta_azul.payload_json IS 'Payload JSON completo retornado pela API do Conta Azul (itens, rateios, etc.)';