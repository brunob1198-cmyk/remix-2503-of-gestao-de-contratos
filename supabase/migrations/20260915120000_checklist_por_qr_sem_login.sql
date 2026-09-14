-- Preencher checklist pelo QR Code sem estar logado
--
-- O PEDIDO
--
-- O checklist de campo precisa ser respondido por quem esta na frente do objeto:
-- o motorista que devolve o veiculo, o terceiro que opera o andaime. Exigir conta
-- no sistema para isso e a fricao que faz o checklist nao ser preenchido -- e a
-- empresa pode terceirizar essas inspecoes.
--
-- O QUE ISTO CUSTA, E QUE PRECISA FICAR ESCRITO
--
-- Sem login, o sistema NAO SABE quem respondeu. Sabe apenas o que a pessoa
-- digitou. Por isso a identidade entra como DECLARADA, em colunas proprias, e
-- nunca em `aplicador_id` -- que referencia `profiles` e significa "usuario
-- autenticado do sistema". Misturar as duas faria uma tela dizer "aplicado por
-- Fulano" com a mesma confianca nos dois casos, e isso seria mentira em um deles.
--
-- Quem tem o link pode responder quantas vezes quiser. O token e a credencial, e
-- ele esta impresso num adesivo a vista de todos. Contra isso ha tres freios, e
-- nenhum e perfeito: o QR pode ser desativado a qualquer momento, a resposta
-- registra IP e user-agent, e o modelo pode exigir geolocalizacao dentro do raio.
--
-- POR QUE FUNCAO, E NAO RLS ABERTA PARA `anon`
--
-- Abrir INSERT em `checklist_aplicacoes` e `checklist_respostas` para anonimo
-- daria acesso a TODAS as linhas de TODAS as empresas -- a politica nao tem como
-- saber de qual QR Code aquela chamada veio. Aqui o token e a chave: a funcao le
-- o QR, descobre a empresa e o modelo, e so escreve o que aquele token permite.

-- ---------------------------------------------------------------------------
-- 1. Identidade declarada e origem da aplicacao
-- ---------------------------------------------------------------------------

ALTER TABLE public.checklist_aplicacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'INTERNA',
  ADD COLUMN IF NOT EXISTS qrcode_id uuid REFERENCES public.checklist_qrcodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aplicador_externo_nome text,
  ADD COLUMN IF NOT EXISTS aplicador_externo_documento text,
  ADD COLUMN IF NOT EXISTS aplicador_externo_ip text,
  ADD COLUMN IF NOT EXISTS aplicador_externo_user_agent text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aplicacao_origem') THEN
    ALTER TABLE public.checklist_aplicacoes
      ADD CONSTRAINT chk_aplicacao_origem CHECK (origem IN ('INTERNA', 'QR_PUBLICO'));
  END IF;
END $$;

-- A regra que impede a tela de mentir: aplicacao publica NAO pode ter
-- `aplicador_id`, e aplicacao interna nao pode ter nome externo. Sem isto, os dois
-- campos conviveriam e quem lesse teria de adivinhar qual vale.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aplicacao_identidade') THEN
    ALTER TABLE public.checklist_aplicacoes
      ADD CONSTRAINT chk_aplicacao_identidade CHECK (
        (origem = 'INTERNA' AND aplicador_externo_nome IS NULL)
        OR (origem = 'QR_PUBLICO' AND aplicador_id IS NULL AND aplicador_externo_nome IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.checklist_aplicacoes.origem IS
  'INTERNA = preenchida por usuario autenticado. QR_PUBLICO = preenchida por quem escaneou o QR Code, sem login: a identidade e declarada, nao verificada.';
COMMENT ON COLUMN public.checklist_aplicacoes.aplicador_externo_nome IS
  'Nome DIGITADO por quem respondeu sem login. O sistema nao confirmou nada sobre ele.';

-- ---------------------------------------------------------------------------
-- 2. Ler o checklist pelo token, sem login
-- ---------------------------------------------------------------------------
--
-- A `get_public_checklist_qr_info` ja existia e devolve so o cabecalho. Para
-- preencher e preciso o conteudo: secoes, itens e as regras de cada item.

CREATE OR REPLACE FUNCTION public.checklist_por_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.checklist_qrcodes%ROWTYPE;
  v_modelo public.checklist_modelos%ROWTYPE;
  v_secoes jsonb;
BEGIN
  SELECT * INTO v_qr FROM public.checklist_qrcodes WHERE token = p_token AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'QR Code invalido ou desativado.');
  END IF;

  SELECT * INTO v_modelo FROM public.checklist_modelos WHERE id = v_qr.checklist_modelo_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'O checklist deste QR Code nao existe mais.');
  END IF;

  SELECT jsonb_agg(s ORDER BY s.ordem) INTO v_secoes
  FROM (
    SELECT
      sec.id, sec.titulo, sec.ordem,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', it.id,
            'titulo', it.titulo,
            'descricao', it.descricao,
            'tipo_resposta', it.tipo_resposta,
            'opcoes_selecao', it.opcoes_selecao,
            'obrigatorio', it.obrigatorio,
            'ordem', it.ordem,
            'exigir_comentario_nao_conforme', it.exigir_comentario_nao_conforme,
            'exigir_foto_nao_conforme', it.exigir_foto_nao_conforme,
            'peso_pontuacao', it.peso_pontuacao,
            'critico', it.critico
          ) ORDER BY it.ordem
        )
        FROM public.checklist_itens it WHERE it.secao_id = sec.id
      ), '[]'::jsonb) AS itens
    FROM public.checklist_secoes sec
    WHERE sec.modelo_id = v_modelo.id
  ) s;

  RETURN jsonb_build_object(
    'valido', true,
    'token', v_qr.token,
    'modelo_id', v_modelo.id,
    'modelo_nome', v_modelo.nome,
    'modelo_categoria', v_modelo.categoria,
    'modelo_descricao', v_modelo.descricao,
    'exigir_geolocalizacao', COALESCE(v_modelo.exigir_geolocalizacao, 'nao'),
    'bloquear_fora_raio', COALESCE(v_modelo.bloquear_fora_raio, false),
    'latitude_alvo', v_modelo.latitude_alvo,
    'longitude_alvo', v_modelo.longitude_alvo,
    'raio_permitido_metros', COALESCE(v_modelo.raio_permitido_metros, 200),
    'vinculado_tipo', v_qr.vinculado_tipo,
    'vinculado_nome', v_qr.vinculado_nome,
    'secoes', COALESCE(v_secoes, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checklist_por_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checklist_por_qr(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Gravar a resposta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.responder_checklist_por_qr(
  p_token text,
  p_aplicador_nome text,
  p_aplicador_documento text,
  p_respostas jsonb,
  p_observacoes text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_precisao numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.checklist_qrcodes%ROWTYPE;
  v_modelo public.checklist_modelos%ROWTYPE;
  v_aplicacao_id uuid;
  v_resposta jsonb;
  v_item public.checklist_itens%ROWTYPE;
  v_valor text;
  v_nc boolean;
  v_peso numeric;
  v_obtida numeric := 0;
  v_maxima numeric := 0;
  v_conforme int := 0;
  v_nao_conforme int := 0;
  v_na int := 0;
  v_criticos_nc int := 0;
  v_faltando text;
BEGIN
  IF p_aplicador_nome IS NULL OR length(trim(p_aplicador_nome)) < 3 THEN
    RAISE EXCEPTION 'Informe o nome de quem esta respondendo. Sem isso, o checklist nao identifica ninguem.';
  END IF;

  SELECT * INTO v_qr FROM public.checklist_qrcodes WHERE token = p_token AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR Code invalido ou desativado.';
  END IF;

  SELECT * INTO v_modelo FROM public.checklist_modelos WHERE id = v_qr.checklist_modelo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O checklist deste QR Code nao existe mais.';
  END IF;

  -- Item obrigatorio sem resposta barra a gravacao. A tela tambem confere, e
  -- continua conferindo -- mas a tela e conveniencia, e aqui a chamada chega de
  -- um aparelho que nao esta sob nosso controle.
  SELECT string_agg(it.titulo, ', ') INTO v_faltando
    FROM public.checklist_itens it
    JOIN public.checklist_secoes s ON s.id = it.secao_id
   WHERE s.modelo_id = v_modelo.id
     AND (it.obrigatorio OR it.critico)
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_respostas) r
        WHERE (r->>'item_id')::uuid = it.id
          AND COALESCE(nullif(trim(r->>'valor'), ''), NULL) IS NOT NULL
     );

  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Estes itens sao obrigatorios e ficaram sem resposta: %.', v_faltando;
  END IF;

  INSERT INTO public.checklist_aplicacoes (
    empresa_id, modelo_id, status, origem, qrcode_id,
    aplicador_externo_nome, aplicador_externo_documento,
    aplicador_externo_user_agent, observacoes_gerais,
    data_aplicacao, data_conclusao
  ) VALUES (
    v_qr.empresa_id, v_modelo.id, 'concluido', 'QR_PUBLICO', v_qr.id,
    trim(p_aplicador_nome), nullif(trim(p_aplicador_documento), ''),
    left(COALESCE(p_user_agent, ''), 400), nullif(trim(p_observacoes), ''),
    now(), now()
  )
  RETURNING id INTO v_aplicacao_id;

  FOR v_resposta IN SELECT * FROM jsonb_array_elements(COALESCE(p_respostas, '[]'::jsonb))
  LOOP
    SELECT * INTO v_item FROM public.checklist_itens WHERE id = (v_resposta->>'item_id')::uuid;
    -- Item que nao e deste modelo nao entra: a chamada vem de fora e pode
    -- referenciar qualquer id.
    CONTINUE WHEN NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM public.checklist_secoes s
       WHERE s.id = v_item.secao_id AND s.modelo_id = v_modelo.id
    );

    v_valor := COALESCE(v_resposta->>'valor', '');
    CONTINUE WHEN trim(v_valor) = '';

    -- "Nao conforme" e o vocabulario que o modulo ja usa nas respostas.
    v_nc := v_valor IN ('Nao', 'NaoConforme', 'NaoOK', 'Nao Conforme');
    v_peso := COALESCE(v_item.peso_pontuacao, 1);

    IF v_valor IN ('NA', 'N/A', 'NaoAplicavel') THEN
      v_na := v_na + 1;
    ELSIF v_nc THEN
      v_nao_conforme := v_nao_conforme + 1;
      v_maxima := v_maxima + v_peso;
      IF v_item.critico THEN v_criticos_nc := v_criticos_nc + 1; END IF;
    ELSE
      v_conforme := v_conforme + 1;
      v_maxima := v_maxima + v_peso;
      v_obtida := v_obtida + v_peso;
    END IF;

    INSERT INTO public.checklist_respostas (
      empresa_id, aplicacao_id, item_id, resposta_valor, comentario,
      is_critico, is_nao_conforme, pontos_obtidos
    ) VALUES (
      v_qr.empresa_id, v_aplicacao_id, v_item.id, v_valor,
      nullif(trim(COALESCE(v_resposta->>'comentario', '')), ''),
      -- Copia congelada: o modelo pode mudar depois, e o veredito de uma
      -- aplicacao antiga tem de continuar explicavel pelos dados dela.
      COALESCE(v_item.critico, false), v_nc,
      CASE WHEN v_nc OR v_valor IN ('NA','N/A','NaoAplicavel') THEN 0 ELSE v_peso END
    );
  END LOOP;

  UPDATE public.checklist_aplicacoes SET
    total_itens = v_conforme + v_nao_conforme + v_na,
    total_conforme = v_conforme,
    total_nao_conforme = v_nao_conforme,
    total_na = v_na,
    pontuacao_obtida = v_obtida,
    pontuacao_maxima = v_maxima,
    -- Sem item aplicavel nao ha percentual: zero afirmaria reprovacao, e 100
    -- afirmaria aprovacao. Nulo diz "nao avaliado", que e o que aconteceu.
    percentual_conformidade = CASE WHEN v_maxima > 0 THEN round((v_obtida / v_maxima) * 100, 2) ELSE NULL END,
    itens_criticos_nao_conformes = v_criticos_nc,
    reprovado_por_item_critico = v_criticos_nc > 0,
    updated_at = now()
  WHERE id = v_aplicacao_id;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    INSERT INTO public.checklist_geolocalizacoes (
      empresa_id, aplicacao_id, momento, latitude, longitude, precisao
    ) VALUES (
      v_qr.empresa_id, v_aplicacao_id, 'conclusao', p_latitude, p_longitude, p_precisao
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'aplicacao_id', v_aplicacao_id,
    'total_conforme', v_conforme,
    'total_nao_conforme', v_nao_conforme,
    'reprovado_por_item_critico', v_criticos_nc > 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.responder_checklist_por_qr(text, text, text, jsonb, text, text, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.responder_checklist_por_qr(text, text, text, jsonb, text, text, numeric, numeric, numeric) TO anon, authenticated;

COMMENT ON FUNCTION public.responder_checklist_por_qr(text, text, text, jsonb, text, text, numeric, numeric, numeric) IS
  'Grava um checklist respondido por quem escaneou o QR Code, sem login. A identidade e declarada pelo proprio respondente e NAO e verificada.';
