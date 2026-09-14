-- Assinar e fechar a solicitacao pelo token, com a ordem conferida no banco
--
-- O DEFEITO QUE ISTO CORRIGE -- E QUE FALHAVA EM SILENCIO
--
-- A assinatura era gravada com um UPDATE direto em `signature_signers`, do
-- navegador do signatario. A RLS daquela tabela exige
--
--   empresa_id = public.get_user_empresa_id(auth.uid())
--
-- Signatario EXTERNO -- o trabalhador, a testemunha, o cliente -- nao tem
-- auth.uid(). O UPDATE entao acerta ZERO LINHAS e NAO retorna erro: a tela dizia
-- "assinatura registrada" e nada havia sido gravado.
--
-- So funcionava para quem estivesse logado na mesma empresa, que e justamente
-- quem NAO precisa do link. O fluxo inteiro existe para quem esta fora.
--
-- A recusa ja passava por funcao SECURITY DEFINER desde a primeira migration; a
-- assinatura ficou de fora por descuido meu. Agora as duas seguem o mesmo caminho.
--
-- A ORDEM DA FILA E CONFERIDA AQUI, EM SQL
--
-- A tela tambem confere, e continua conferindo -- mas a tela e conveniencia. Quem
-- montar a chamada a mao chega direto na funcao, e a ordem e exatamente o que
-- este fluxo promete. Promessa que so a interface guarda nao esta guardada.

-- ---------------------------------------------------------------------------
-- 1. Nome da empresa na leitura por token
-- ---------------------------------------------------------------------------
--
-- A folha de assinaturas saia com "Empresa:" em branco porque lia
-- `signature_signers.empresa_nome`, que so e preenchido quando quem cadastra
-- digita. O nome da organizacao esta em `empresas`, fechada por RLS -- mas esta
-- funcao e SECURITY DEFINER e pode le-la.

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
  v_empresa_nome text;
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

  SELECT nome INTO v_empresa_nome FROM public.empresas WHERE id = v_signer.empresa_id;

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
    -- O da organizacao primeiro; o do signatario so quando ele representa outra.
    'empresaNome', COALESCE(v_empresa_nome, v_signer.empresa_nome),
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
-- 2. Assinar
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assinar_por_token(
  p_token text,
  p_confirmacao text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer public.signature_signers%ROWTYPE;
  v_request public.signature_requests%ROWTYPE;
  v_pendentes_antes int;
  v_recusas int;
  v_restantes int;
BEGIN
  SELECT * INTO v_signer FROM public.signature_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Link invalido.');
  END IF;

  IF v_signer.status <> 'PENDENTE' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este signatario ja respondeu.');
  END IF;

  SELECT * INTO v_request FROM public.signature_requests WHERE id = v_signer.signature_request_id;

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O prazo para assinatura venceu.');
  END IF;

  -- Uma recusa interrompe a fila inteira: mesma regra da tela e do util.
  SELECT count(*) INTO v_recusas
  FROM public.signature_signers
  WHERE signature_request_id = v_signer.signature_request_id AND status = 'RECUSADO';

  IF v_recusas > 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Um signatario recusou e a fila foi interrompida.');
  END IF;

  -- A VEZ: existe alguem pendente com ordem MENOR? Comparacao estrita, e nao
  -- "menor ou igual", porque ordem repetida assina em paralelo -- duas
  -- testemunhas no mesmo nivel nao esperam uma a outra.
  SELECT count(*) INTO v_pendentes_antes
  FROM public.signature_signers
  WHERE signature_request_id = v_signer.signature_request_id
    AND status = 'PENDENTE'
    AND ordem < v_signer.ordem;

  IF v_pendentes_antes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Ainda nao e a vez deste signatario.');
  END IF;

  UPDATE public.signature_signers
  SET status = 'ASSINADO', signed_at = now()
  WHERE id = v_signer.id;

  INSERT INTO public.signature_events (empresa_id, signature_request_id, evento, user_agent, metadata)
  VALUES (
    v_signer.empresa_id,
    v_signer.signature_request_id,
    'ASSINATURA_CONCLUIDA',
    p_user_agent,
    jsonb_build_object('signatario', v_signer.nome, 'confirmacao', p_confirmacao)
  );

  SELECT count(*) INTO v_restantes
  FROM public.signature_signers
  WHERE signature_request_id = v_signer.signature_request_id AND status = 'PENDENTE';

  RETURN jsonb_build_object(
    'ok', true,
    'filaConcluida', v_restantes = 0,
    'solicitacaoId', v_signer.signature_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assinar_por_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinar_por_token(text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fechar a solicitacao e guardar a folha final
-- ---------------------------------------------------------------------------
--
-- Tambem precisava ser funcao: gravar `arquivo_assinado` era UPDATE direto em
-- `signature_documents`, e o signatario externo esbarraria na mesma RLS.

CREATE OR REPLACE FUNCTION public.fechar_solicitacao_por_token(
  p_token text,
  p_arquivo_assinado text,
  p_hash_original text,
  p_hash_assinado text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer public.signature_signers%ROWTYPE;
  v_pendentes int;
BEGIN
  SELECT * INTO v_signer FROM public.signature_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Link invalido.');
  END IF;

  -- So fecha o que esta realmente completo. Sem esta checagem, uma chamada
  -- montada a mao marcaria como concluida uma fila com gente sem assinar.
  SELECT count(*) INTO v_pendentes
  FROM public.signature_signers
  WHERE signature_request_id = v_signer.signature_request_id AND status = 'PENDENTE';

  IF v_pendentes > 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'A fila ainda tem signatarios pendentes.');
  END IF;

  UPDATE public.signature_documents
  SET arquivo_assinado = p_arquivo_assinado,
      hash_original = COALESCE(NULLIF(p_hash_original, ''), hash_original),
      hash_assinado = p_hash_assinado
  WHERE signature_request_id = v_signer.signature_request_id;

  UPDATE public.signature_requests
  SET status = 'CONCLUIDO', updated_at = now()
  WHERE id = v_signer.signature_request_id;

  INSERT INTO public.signature_events (empresa_id, signature_request_id, evento, metadata)
  VALUES (
    v_signer.empresa_id,
    v_signer.signature_request_id,
    'DOCUMENTO_GERADO',
    jsonb_build_object('hash_assinado', p_hash_assinado)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_solicitacao_por_token(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fechar_solicitacao_por_token(text, text, text, text) TO anon, authenticated;
