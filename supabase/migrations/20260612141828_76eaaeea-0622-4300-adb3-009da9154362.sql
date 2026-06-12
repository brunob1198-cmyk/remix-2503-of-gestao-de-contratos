
-- FK requisicao_id em cotacoes já existe apontando para requisicoes_compra(id).
-- workflow_status (text) já possui valores: rascunho, pendente_aprovacao, em_cotacao, aprovada, pedido_emitido, encerrada.
-- Apenas criamos a função + trigger adaptados ao schema real.

CREATE OR REPLACE FUNCTION public.fn_rc_para_em_cotacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requisicao_id IS NOT NULL THEN
    UPDATE public.requisicoes_compra
       SET workflow_status = 'em_cotacao',
           updated_at = now()
     WHERE id = NEW.requisicao_id
       AND workflow_status NOT IN ('aprovada', 'pedido_emitido', 'encerrada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_em_cotacao ON public.cotacoes;
CREATE TRIGGER trg_rc_em_cotacao
  AFTER INSERT ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_rc_para_em_cotacao();
