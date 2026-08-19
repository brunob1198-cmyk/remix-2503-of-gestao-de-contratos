-- Migration: trava de tenant em gerar_proximo_numero_sc
--
-- A funcao e SECURITY DEFINER (ignora RLS), recebe p_empresa_id do cliente e
-- estava executavel por anon/authenticated sem validar o tenant. Verificado em
-- 19/08/2026: uma chamada anonima com um empresa_id arbitrario respondia HTTP 200.
--
-- Com o UUID real de outra empresa, o numero devolvido e MAX(numero) + 1 sobre
-- requisicoes_compra, cotacoes ou pedidos daquela empresa — ou seja, revela
-- quantos documentos de compra ela tem. Vazamento de volume comercial entre
-- tenants.
--
-- Mesma correcao aplicada em sgsst_dashboard_metrics e sgsst_dashboard_alertas.
--
-- Compatibilidade: os tres chamadores em src/hooks/useSupplyChain.ts obtem o
-- empresa_id via getEmpresaId(), que le profiles.empresa_id do proprio usuario
-- autenticado. A guarda nao altera o comportamento do fluxo legitimo.

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
  -- Trava de tenant: a funcao ignora RLS, entao o p_empresa_id recebido do
  -- cliente precisa ser conferido contra o usuario logado.
  IF p_empresa_id IS NULL
     OR p_empresa_id IS DISTINCT FROM public.get_user_empresa_id(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: empresa_id nao corresponde ao usuario autenticado.'
      USING ERRCODE = '42501';
  END IF;

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

-- Revoga do anon: gerar numero de documento de compra e operacao de usuario
-- autenticado, nunca de visitante.
REVOKE EXECUTE ON FUNCTION public.gerar_proximo_numero_sc(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerar_proximo_numero_sc(uuid, text) TO authenticated;
