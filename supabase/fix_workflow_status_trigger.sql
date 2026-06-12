-- Script para corrigir a trigger de criação de cotação
-- Isso evita o erro: violates check constraint "requisicoes_compra_workflow_status_check"

CREATE OR REPLACE FUNCTION public.fn_rc_para_em_cotacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requisicao_id IS NOT NULL THEN
    UPDATE public.requisicoes_compra
       -- Usa o valor correto em inglês permitido pela constraint
       SET workflow_status = 'QUOTING',
           updated_at = now()
     WHERE id = NEW.requisicao_id
       -- Usa os valores corretos em inglês para a comparação
       AND workflow_status NOT IN ('APPROVED', 'PURCHASE_ORDER_CREATED', 'CLOSED');
  END IF;
  RETURN NEW;
END;
$$;
