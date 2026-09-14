-- Editar um modelo de checklist passa a EDITAR, e nao a criar outro
--
-- O DEFEITO
--
-- `handleSaveModelo` na tela de checklists era isto:
--
--   if (editingModelo) {
--     await createModelo.mutateAsync(data);   // cria
--   } else {
--     await createModelo.mutateAsync(data);   // cria
--   }
--
-- As duas ramificacoes chamam a mesma coisa. O `if` e um lugar reservado para o
-- update que nunca foi escrito. Toda edicao tentava INSERIR outro modelo com o
-- mesmo codigo, e o indice unico barrava:
--
--   duplicate key value violates unique constraint "uq_checklist_modelo_codigo"
--
-- Ou seja: nenhuma alteracao em modelo de checklist jamais foi salva. A mensagem
-- ainda dizia "Erro ao criar modelo" no meio de uma edicao, que era a pista.
--
-- POR QUE UMA FUNCAO, E NAO VARIOS UPDATES DO CLIENTE
--
-- Salvar um modelo mexe em tres tabelas: o modelo, as secoes e os itens. Feito em
-- chamadas separadas do navegador, uma falha no meio deixa o modelo atualizado e
-- as secoes pela metade — e, pior, uma segunda tentativa INSERE de novo os itens
-- que ja tinham entrado, porque no rascunho da tela eles continuam sem id.
--
-- Dentro de uma funcao, tudo isso e uma transacao so: ou vai inteiro, ou nao vai
-- nada, e tentar de novo e sempre seguro.
--
-- SEM `SECURITY DEFINER` DE PROPOSITO
--
-- A funcao roda como o usuario que chamou, entao a RLS das tres tabelas continua
-- valendo. Nao ha por que elevar privilegio: quem edita um modelo de checklist
-- esta logado e tem a propria empresa. Elevar aqui so criaria uma porta que
-- alguem teria de lembrar de fechar.
--
-- O `IF NOT FOUND` depois do UPDATE nao e paranoia: com RLS, um update que nao
-- casa com a politica acerta ZERO linhas e NAO da erro. Sem essa checagem, editar
-- o modelo de outra empresa responderia "salvo com sucesso" sem salvar nada.

CREATE OR REPLACE FUNCTION public.salvar_modelo_de_checklist(p_modelo jsonb)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_empresa uuid;
  v_secao jsonb;
  v_item jsonb;
  v_secao_id uuid;
  v_item_id uuid;
  v_secoes_mantidas uuid[] := ARRAY[]::uuid[];
  v_itens_mantidos uuid[] := ARRAY[]::uuid[];
  v_respondidos text;
BEGIN
  v_id := NULLIF(p_modelo->>'id', '')::uuid;
  v_empresa := NULLIF(p_modelo->>'empresa_id', '')::uuid;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa nao identificada para salvar o modelo.';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. O modelo
  -- -------------------------------------------------------------------------
  IF v_id IS NULL THEN
    -- `codigo` nulo deixa o gatilho `trg_checklist_modelo_codigo` numerar
    -- sequencialmente por empresa e ano. Sugerir numero aqui anularia isso.
    INSERT INTO public.checklist_modelos (
      empresa_id, nome, categoria, codigo, descricao, periodicidade_sugerida,
      responsavel_id, projeto_id, area_id, tipo_aplicacao, created_by, status,
      exigir_geolocalizacao, latitude_alvo, longitude_alvo,
      raio_permitido_metros, bloquear_fora_raio
    ) VALUES (
      v_empresa,
      p_modelo->>'nome',
      COALESCE(NULLIF(p_modelo->>'categoria', ''), 'Geral'),
      NULLIF(p_modelo->>'codigo', ''),
      NULLIF(p_modelo->>'descricao', ''),
      COALESCE(NULLIF(p_modelo->>'periodicidade_sugerida', ''), 'Diario'),
      NULLIF(p_modelo->>'responsavel_id', '')::uuid,
      NULLIF(p_modelo->>'projeto_id', '')::uuid,
      NULLIF(p_modelo->>'area_id', '')::uuid,
      COALESCE(NULLIF(p_modelo->>'tipo_aplicacao', ''), 'Geral'),
      -- `created_by` referencia `profiles(id)`, e `profiles.id` E o
      -- `auth.users(id)` — a tabela e declarada como
      -- `id uuid PRIMARY KEY REFERENCES auth.users(id)`. Por isso `auth.uid()`
      -- serve aqui; nao fosse assim, a chave estrangeira recusaria.
      auth.uid(),
      'ativo',
      COALESCE(NULLIF(p_modelo->>'exigir_geolocalizacao', ''), 'nao'),
      NULLIF(p_modelo->>'latitude_alvo', '')::numeric,
      NULLIF(p_modelo->>'longitude_alvo', '')::numeric,
      COALESCE(NULLIF(p_modelo->>'raio_permitido_metros', '')::integer, 200),
      COALESCE((p_modelo->>'bloquear_fora_raio')::boolean, false)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.checklist_modelos SET
      nome = p_modelo->>'nome',
      categoria = COALESCE(NULLIF(p_modelo->>'categoria', ''), categoria),
      -- Codigo em branco preserva o que ja existe: o gatilho so numera na
      -- insercao, e apagar aqui deixaria o modelo sem identificacao nenhuma.
      codigo = COALESCE(NULLIF(p_modelo->>'codigo', ''), codigo),
      descricao = NULLIF(p_modelo->>'descricao', ''),
      periodicidade_sugerida = COALESCE(
        NULLIF(p_modelo->>'periodicidade_sugerida', ''), periodicidade_sugerida
      ),
      responsavel_id = NULLIF(p_modelo->>'responsavel_id', '')::uuid,
      projeto_id = NULLIF(p_modelo->>'projeto_id', '')::uuid,
      area_id = NULLIF(p_modelo->>'area_id', '')::uuid,
      exigir_geolocalizacao = COALESCE(
        NULLIF(p_modelo->>'exigir_geolocalizacao', ''), exigir_geolocalizacao
      ),
      latitude_alvo = NULLIF(p_modelo->>'latitude_alvo', '')::numeric,
      longitude_alvo = NULLIF(p_modelo->>'longitude_alvo', '')::numeric,
      raio_permitido_metros = COALESCE(
        NULLIF(p_modelo->>'raio_permitido_metros', '')::integer, 200
      ),
      bloquear_fora_raio = COALESCE((p_modelo->>'bloquear_fora_raio')::boolean, false),
      updated_at = now()
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Modelo de checklist nao encontrado, ou sem permissao para edita-lo.';
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Secoes e itens
  -- -------------------------------------------------------------------------
  FOR v_secao IN SELECT * FROM jsonb_array_elements(COALESCE(p_modelo->'secoes', '[]'::jsonb))
  LOOP
    v_secao_id := NULLIF(v_secao->>'id', '')::uuid;

    IF v_secao_id IS NULL THEN
      INSERT INTO public.checklist_secoes (empresa_id, modelo_id, titulo, ordem)
      VALUES (
        v_empresa, v_id, v_secao->>'titulo',
        COALESCE(NULLIF(v_secao->>'ordem', '')::integer, 1)
      )
      RETURNING id INTO v_secao_id;
    ELSE
      UPDATE public.checklist_secoes SET
        titulo = v_secao->>'titulo',
        ordem = COALESCE(NULLIF(v_secao->>'ordem', '')::integer, ordem),
        updated_at = now()
      WHERE id = v_secao_id AND modelo_id = v_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Secao % nao pertence a este modelo.', v_secao_id;
      END IF;
    END IF;

    v_secoes_mantidas := v_secoes_mantidas || v_secao_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_secao->'itens', '[]'::jsonb))
    LOOP
      v_item_id := NULLIF(v_item->>'id', '')::uuid;

      IF v_item_id IS NULL THEN
        INSERT INTO public.checklist_itens (
          empresa_id, secao_id, titulo, descricao, tipo_resposta, opcoes_selecao,
          obrigatorio, ordem, exigir_comentario_nao_conforme,
          exigir_foto_nao_conforme, gerar_plano_acao_nao_conforme,
          peso_pontuacao, critico
        ) VALUES (
          v_empresa, v_secao_id, v_item->>'titulo', NULLIF(v_item->>'descricao', ''),
          COALESCE(NULLIF(v_item->>'tipo_resposta', ''), 'Conforme_NaoConforme'),
          CASE
            WHEN jsonb_typeof(v_item->'opcoes_selecao') = 'array'
              AND jsonb_array_length(v_item->'opcoes_selecao') > 0
            THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'opcoes_selecao'))
            ELSE NULL
          END,
          COALESCE((v_item->>'obrigatorio')::boolean, true),
          COALESCE(NULLIF(v_item->>'ordem', '')::integer, 1),
          COALESCE((v_item->>'exigir_comentario_nao_conforme')::boolean, true),
          COALESCE((v_item->>'exigir_foto_nao_conforme')::boolean, false),
          COALESCE((v_item->>'gerar_plano_acao_nao_conforme')::boolean, true),
          COALESCE(NULLIF(v_item->>'peso_pontuacao', '')::numeric, 1),
          COALESCE((v_item->>'critico')::boolean, false)
        )
        RETURNING id INTO v_item_id;
      ELSE
        UPDATE public.checklist_itens SET
          titulo = v_item->>'titulo',
          descricao = NULLIF(v_item->>'descricao', ''),
          tipo_resposta = COALESCE(NULLIF(v_item->>'tipo_resposta', ''), tipo_resposta),
          opcoes_selecao = CASE
            WHEN jsonb_typeof(v_item->'opcoes_selecao') = 'array'
              AND jsonb_array_length(v_item->'opcoes_selecao') > 0
            THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'opcoes_selecao'))
            ELSE NULL
          END,
          obrigatorio = COALESCE((v_item->>'obrigatorio')::boolean, obrigatorio),
          ordem = COALESCE(NULLIF(v_item->>'ordem', '')::integer, ordem),
          exigir_comentario_nao_conforme = COALESCE(
            (v_item->>'exigir_comentario_nao_conforme')::boolean, exigir_comentario_nao_conforme
          ),
          exigir_foto_nao_conforme = COALESCE(
            (v_item->>'exigir_foto_nao_conforme')::boolean, exigir_foto_nao_conforme
          ),
          gerar_plano_acao_nao_conforme = COALESCE(
            (v_item->>'gerar_plano_acao_nao_conforme')::boolean, gerar_plano_acao_nao_conforme
          ),
          peso_pontuacao = COALESCE(NULLIF(v_item->>'peso_pontuacao', '')::numeric, peso_pontuacao),
          critico = COALESCE((v_item->>'critico')::boolean, critico),
          updated_at = now()
        WHERE id = v_item_id AND secao_id = v_secao_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item % nao pertence a esta secao.', v_item_id;
        END IF;
      END IF;

      v_itens_mantidos := v_itens_mantidos || v_item_id;
    END LOOP;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 3. O que o usuario tirou do modelo
  -- -------------------------------------------------------------------------
  --
  -- `checklist_respostas.item_id` e ON DELETE RESTRICT: item ja respondido nao
  -- pode sumir, senao o checklist aplicado passaria a apontar para o vazio e o
  -- historico deixaria de bater. A regra e do banco e esta certa — o problema e
  -- que, batendo nela, o usuario receberia um erro de chave estrangeira em
  -- ingles. Entao a recusa vem ANTES, dizendo quais itens e por que.
  SELECT string_agg(DISTINCT i.titulo, ', ')
    INTO v_respondidos
    FROM public.checklist_itens i
    JOIN public.checklist_secoes s ON s.id = i.secao_id
   WHERE s.modelo_id = v_id
     AND NOT (i.id = ANY(v_itens_mantidos))
     AND EXISTS (SELECT 1 FROM public.checklist_respostas r WHERE r.item_id = i.id);

  IF v_respondidos IS NOT NULL THEN
    RAISE EXCEPTION 'Estes itens ja foram respondidos em checklists aplicados e por isso nao podem ser excluidos: %. Da para editar o texto deles; para mudar a estrutura, duplique o modelo e edite a copia.', v_respondidos;
  END IF;

  DELETE FROM public.checklist_itens i
   USING public.checklist_secoes s
   WHERE s.id = i.secao_id
     AND s.modelo_id = v_id
     AND NOT (i.id = ANY(v_itens_mantidos));

  DELETE FROM public.checklist_secoes
   WHERE modelo_id = v_id
     AND NOT (id = ANY(v_secoes_mantidas));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_modelo_de_checklist(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_modelo_de_checklist(jsonb) TO authenticated;

COMMENT ON FUNCTION public.salvar_modelo_de_checklist(jsonb) IS
  'Cria ou atualiza um modelo de checklist com suas secoes e itens, numa transacao so. Id nulo cria; id preenchido edita. Recusa excluir item ja respondido.';
