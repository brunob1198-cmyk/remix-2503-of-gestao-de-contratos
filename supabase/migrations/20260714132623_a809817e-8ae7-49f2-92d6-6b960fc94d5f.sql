-- Renumera a requisição duplicada mais recente para RC-0003 e cria a função atômica de numeração
UPDATE public.requisicoes_compra
SET numero = 'RC-0003', updated_at = now()
WHERE id = '42d5905f-324c-4bfd-848e-7fc9cfb8bb51'
  AND numero = 'RC-0002';

-- Índice único para evitar duplicidades futuras por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_requisicoes_compra_empresa_numero
  ON public.requisicoes_compra (empresa_id, numero);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cotacoes_empresa_numero
  ON public.cotacoes (empresa_id, numero);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pedidos_empresa_numero
  ON public.pedidos (empresa_id, numero);

-- Função atômica de geração de próximo número sequencial por empresa/prefixo
CREATE OR REPLACE FUNCTION public.gerar_proximo_numero_sc(p_empresa_id uuid, p_prefixo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
  v_tabela text;
BEGIN
  IF p_prefixo = 'RC' THEN v_tabela := 'requisicoes_compra';
  ELSIF p_prefixo = 'COT' THEN v_tabela := 'cotacoes';
  ELSIF p_prefixo = 'PED' THEN v_tabela := 'pedidos';
  ELSE RAISE EXCEPTION 'Prefixo inválido: %', p_prefixo;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM %L) AS INT)), 0) + 1
     FROM public.%I
     WHERE empresa_id = $1 AND numero ~ %L',
    length(p_prefixo) + 2,
    v_tabela,
    '^' || p_prefixo || '-\d+$'
  )
  INTO v_next
  USING p_empresa_id;

  RETURN p_prefixo || '-' || lpad(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_proximo_numero_sc(uuid, text) TO authenticated;