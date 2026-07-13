
-- 1) Ampliar constraint de workflow_status para incluir CANCELLED
ALTER TABLE public.requisicoes_compra DROP CONSTRAINT IF EXISTS requisicoes_compra_workflow_status_check;
ALTER TABLE public.requisicoes_compra ADD CONSTRAINT requisicoes_compra_workflow_status_check
  CHECK (workflow_status = ANY (ARRAY[
    'DRAFT','SUBMITTED','QUOTING','QUOTE_COMPLETED','PENDING_APPROVAL',
    'APPROVED','REJECTED','CANCELLED','PURCHASE_ORDER_CREATED','PURCHASED',
    'PARTIALLY_RECEIVED','RECEIVED','CLOSED'
  ]));

-- 2) Backfill: se workflow_status estiver nulo, derivar do legacy status
UPDATE public.requisicoes_compra
SET workflow_status = CASE lower(coalesce(status,''))
    WHEN 'rascunho' THEN 'DRAFT'
    WHEN 'pendente_aprovacao' THEN 'PENDING_APPROVAL'
    WHEN 'em_cotacao' THEN 'QUOTING'
    WHEN 'aprovada' THEN 'APPROVED'
    WHEN 'rejeitada' THEN 'REJECTED'
    WHEN 'cancelada' THEN 'CANCELLED'
    WHEN 'pedido_emitido' THEN 'PURCHASE_ORDER_CREATED'
    WHEN 'entregue' THEN 'RECEIVED'
    ELSE 'DRAFT'
  END
WHERE workflow_status IS NULL;
