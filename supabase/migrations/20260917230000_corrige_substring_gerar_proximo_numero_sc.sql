-- Corrige gerar_proximo_numero_sc: SUBSTRING pegava o overload de regex, nao o de posicao
--
-- A funcao montava "SUBSTRING(numero FROM %L)" onde %L (quote_nullable) envolve o
-- numero da posicao em aspas, por exemplo FROM '4'. Um literal de texto entre aspas
-- nessa posicao faz o Postgres escolher o overload substring(text, pattern) — busca
-- por regex — em vez de substring(text, int) — posicao. Ou seja, a funcao nunca
-- extraiu "a partir da posicao 4"; ela procurava o CARACTERE "4" dentro do proprio
-- numero (ex.: em 'RC-0001' nao ha nenhum "4", entao o resultado era NULL).
--
-- Com todo mundo em NULL, MAX(...) tambem da NULL, COALESCE cai para 0, e a funcao
-- sempre devolvia "<PREFIXO>-0001" — mesmo com RC-0001 ja existente. Dai o erro
-- "Este registro ja existe" (23505 em uniq_requisicoes_compra_empresa_numero) ao
-- tentar criar qualquer requisicao nova, nao so na segunda tentativa.
--
-- A correcao usa bind parameters em vez de %L: a posicao vira uma expressao inteira
-- de verdade (length($2) + 2), sem passar por um literal de texto entre aspas, entao
-- so pode casar com o overload de posicao.
--
-- Tambem adiciona um advisory lock por empresa+prefixo: fecha a janela em que duas
-- chamadas simultaneas desta funcao calculavam o mesmo MAX antes de qualquer INSERT
-- confirmar. Nao cobre a corrida entre esta funcao e o INSERT seguinte (chamadas
-- HTTP separadas, sem transacao compartilhada) — isso exigiria uma unica RPC
-- transacional para numerar + inserir, o que fica para outra mudanca se voltar a
-- acontecer.

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

  -- Serializa chamadas concorrentes para a mesma empresa+prefixo.
  PERFORM pg_advisory_xact_lock(hashtext(p_empresa_id::text), hashtext(p_prefixo));

  EXECUTE format(
    'SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM (length($2) + 2)) AS INT)), 0) + 1
     FROM public.%I
     WHERE empresa_id = $1 AND numero ~ (''^'' || $2 || ''-\d+$'')',
    v_tabela
  )
  INTO v_next
  USING p_empresa_id, p_prefixo;

  RETURN p_prefixo || '-' || lpad(v_next::text, 4, '0');
END;
$$;
