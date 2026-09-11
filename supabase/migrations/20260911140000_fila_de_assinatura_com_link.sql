-- Fila de assinatura com link individual por signatario
--
-- O QUE JA EXISTIA
--
-- As quatro tabelas de assinatura (20260817000000) foram desenhadas para isto:
-- `signature_signers` tem `ordem INT NOT NULL DEFAULT 1` desde a criacao. Mas
-- nada usava. `SignatureService.sign()` inseria o signatario NO MOMENTO da
-- assinatura, com `ordem: 1` fixo no codigo -- havia um campo de fila e nenhuma
-- fila.
--
-- O QUE FALTAVA PARA O FLUXO PEDIDO (assinador 1, 2, 3, um de cada vez)
--
-- 1. Um TOKEN por signatario, que e o que transforma "linha no banco" em "link
--    que a pessoa recebe".
-- 2. Uma forma de o signatario EXTERNO ler e gravar sem ter conta no sistema.
--
-- POR QUE NAO ABRIR AS TABELAS PARA `anon`
--
-- A saida obvia seria uma policy permitindo `anon` ler `signature_signers` pelo
-- token. Ela vaza tudo: com SELECT liberado na tabela, qualquer um lista nomes,
-- CPFs e e-mails de todos os signatarios de todas as empresas -- o token filtra a
-- linha que voce QUER, nao a que voce PODE.
--
-- Por isso o acesso externo passa por tres funcoes SECURITY DEFINER que recebem o
-- token e devolvem so o que aquele signatario precisa ver. As tabelas continuam
-- fechadas por empresa, como estao.
--
-- SOBRE O TOKEN
--
-- 32 bytes de `gen_random_bytes`, em hex: 64 caracteres, imprevisivel. Nao usar o
-- id do signatario como link -- UUID v4 tambem e imprevisivel, mas ele aparece em
-- log, em URL de API e em mensagem de erro, e ai o link de assinar vaza junto.

-- ---------------------------------------------------------------------------
-- 1. Token e recusa no signatario
-- ---------------------------------------------------------------------------

ALTER TABLE public.signature_signers
  ADD COLUMN IF NOT EXISTS token text,
  -- Motivo da recusa. Recusa sem motivo obriga o solicitante a ligar para a
  -- pessoa para descobrir o que aconteceu.
  ADD COLUMN IF NOT EXISTS recusa_motivo text,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz,
  -- Quando o link foi aberto pela primeira vez. Separa "nao assinou" de "nem
  -- recebeu" -- que pedem providencias diferentes: cobrar a pessoa ou reenviar.
  ADD COLUMN IF NOT EXISTS primeiro_acesso_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_signature_signers_token
  ON public.signature_signers(token) WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signature_signers_request_ordem
  ON public.signature_signers(signature_request_id, ordem);

COMMENT ON COLUMN public.signature_signers.token IS
  'Segredo do link individual de assinatura. 64 caracteres hex. Nulo para signatario registrado direto pelo app, sem link externo.';
COMMENT ON COLUMN public.signature_signers.ordem IS
  'Posicao na fila. Ordem repetida entre dois signatarios significa assinatura em paralelo -- o caso das duas testemunhas.';

-- ---------------------------------------------------------------------------
-- 2. Gerador de token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gerar_token_de_assinatura()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(gen_random_bytes(32), 'hex');
$$;

COMMENT ON FUNCTION public.gerar_token_de_assinatura IS
  'Token imprevisivel para o link de assinatura. Nao usar o id do signatario: UUID aparece em log e em URL de API, e o link vazaria junto.';

-- ---------------------------------------------------------------------------
-- 3. Leitura publica pelo token
-- ---------------------------------------------------------------------------
--
-- Devolve o que o signatario precisa para decidir se assina: o documento, quem
-- ja assinou antes dele, e se e a vez dele. NAO devolve CPF nem e-mail dos
-- outros signatarios -- quem assina precisa saber QUEM assinou, nao os dados
-- pessoais de cada um.

CREATE OR REPLACE FUNCTION public.assinatura_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer public.signature_signers%ROWTYPE;
  v_request public.signature_requests%ROWTYPE;
  v_documento public.signature_documents%ROWTYPE;
  v_fila jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  SELECT * INTO v_signer FROM public.signature_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  SELECT * INTO v_request FROM public.signature_requests WHERE id = v_signer.signature_request_id;
  SELECT * INTO v_documento FROM public.signature_documents
    WHERE signature_request_id = v_signer.signature_request_id
    ORDER BY created_at DESC LIMIT 1;

  -- A fila inteira, sem dado pessoal dos outros. O nome vai porque quem assina
  -- precisa saber quem mais assina o mesmo documento.
  SELECT jsonb_agg(
    jsonb_build_object('id', s.id, 'nome', s.nome, 'ordem', s.ordem,
                       'status', s.status, 'assinadoEm', s.signed_at)
    ORDER BY s.ordem, s.created_at
  ) INTO v_fila
  FROM public.signature_signers s
  WHERE s.signature_request_id = v_signer.signature_request_id;

  RETURN jsonb_build_object(
    'encontrado', true,
    'signatarioId', v_signer.id,
    'nome', v_signer.nome,
    'cargo', v_signer.cargo,
    'empresaNome', v_signer.empresa_nome,
    'solicitacaoId', v_request.id,
    'moduloOrigem', v_request.modulo_origem,
    'entidadeTipo', v_request.entidade_tipo,
    'documentoId', v_request.documento_id,
    'expiraEm', v_request.expires_at,
    'arquivoOriginal', v_documento.arquivo_original,
    'fila', COALESCE(v_fila, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assinatura_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinatura_por_token(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Marcar o primeiro acesso
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_acesso_ao_link(p_token text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só o PRIMEIRO acesso: sobrescrever a cada abertura perderia a informacao que
  -- interessa, que e ha quanto tempo a pessoa recebeu e nao assinou.
  UPDATE public.signature_signers
  SET primeiro_acesso_em = now()
  WHERE token = p_token AND primeiro_acesso_em IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso_ao_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_acesso_ao_link(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Recusar pelo token
-- ---------------------------------------------------------------------------
--
-- A recusa fica no banco, e nao so no app, porque e a unica operacao de escrita
-- que o signatario externo precisa alem de assinar -- e porque uma recusa que o
-- solicitante nao ve equivale a documento parado sem explicacao.

CREATE OR REPLACE FUNCTION public.recusar_assinatura_por_token(
  p_token text,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer public.signature_signers%ROWTYPE;
BEGIN
  SELECT * INTO v_signer FROM public.signature_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Link invalido.');
  END IF;

  IF v_signer.status <> 'PENDENTE' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este signatario ja respondeu.');
  END IF;

  UPDATE public.signature_signers
  SET status = 'RECUSADO', recusa_motivo = p_motivo, recusado_em = now()
  WHERE id = v_signer.id;

  -- A recusa interrompe a solicitacao inteira: deixar os seguintes assinarem
  -- produziria documento assinado por uns e recusado por outro, que nao e
  -- assinado nem recusado.
  UPDATE public.signature_requests
  SET status = 'RECUSADO', updated_at = now()
  WHERE id = v_signer.signature_request_id;

  INSERT INTO public.signature_events (empresa_id, signature_request_id, evento, metadata)
  VALUES (
    v_signer.empresa_id,
    v_signer.signature_request_id,
    'ASSINATURA_RECUSADA',
    jsonb_build_object('signatario', v_signer.nome, 'motivo', p_motivo)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recusar_assinatura_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recusar_assinatura_por_token(text, text) TO anon, authenticated;
