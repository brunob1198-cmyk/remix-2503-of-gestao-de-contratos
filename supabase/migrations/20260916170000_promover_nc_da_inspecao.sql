-- Promover a nao conformidade da inspecao para o modulo de NC do SGSST
--
-- O QUE FALTAVA
--
-- Roteiro 9.10: "Promover uma NC da inspecao para nao conformidade independente
-- -> Vira registro na R10 com a origem 'inspecao' preservada."
--
-- A metade que LE estava pronta ha tempos. Em NaoConformidadesDetail.tsx:
--
--   {currentNc.origem_tipo === "INSPECAO" && currentNc.origem_id && (
--     <Button ...>  voltar para a inspecao de origem
--
-- E o banco estava pronto tambem: `origem_tipo` aceita 'INSPECAO' desde o
-- CREATE TABLE, ha `origem_id`, e ha indice em (empresa_id, origem_tipo,
-- origem_id).
--
-- A metade que ESCREVE nao existia. Nenhum caminho do aplicativo gravava uma NC
-- com origem INSPECAO -- so o formulario manual, e ele tem seletor para
-- `origem_tipo` e NENHUM campo para `origem_id`, entao gravava a etiqueta sem o
-- vinculo. Ou seja: aquele botao de voltar a inspecao nunca podia aparecer.
--
-- O QUE ESTA COLUNA RESOLVE
--
-- Guarda a NC do SGSST criada a partir daquele achado. Serve a duas coisas:
--
-- 1. Impedir promover duas vezes. Sem isto, dois cliques criariam duas NCs
--    identicas, e o modulo de NC passaria a contar o mesmo desvio duas vezes --
--    justamente onde os indicadores de seguranca sao lidos.
--
-- 2. Mostrar na inspecao que aquele achado ja virou tratamento formal, com link.
--    Sem a coluna, a tela da inspecao nao teria como saber, e quem confere
--    perguntaria "isso foi escalado?" a cada leitura.
--
-- ON DELETE SET NULL de proposito: apagar a NC do SGSST nao pode apagar o achado
-- da inspecao, que e o registro historico do que foi visto em campo.

ALTER TABLE public.sgsst_inspecoes_nao_conformidades
  ADD COLUMN IF NOT EXISTS nc_sgsst_id uuid
    REFERENCES public.sgsst_nao_conformidades(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sgsst_inspecoes_nao_conformidades.nc_sgsst_id IS
  'NC do modulo SGSST criada a partir deste achado. Nulo enquanto o achado nao foi promovido. Impede promocao duplicada e sustenta o link nas duas direcoes.';

CREATE INDEX IF NOT EXISTS idx_sgsst_insp_nc_promovida
  ON public.sgsst_inspecoes_nao_conformidades(nc_sgsst_id)
  WHERE nc_sgsst_id IS NOT NULL;

-- ============================================================================
-- A promocao em si, numa transacao
-- ============================================================================
--
-- POR QUE FUNCAO, E NAO DOIS INSERTS DO CLIENTE
--
-- Sao duas escritas que precisam valer juntas: criar a NC e marcar o achado como
-- promovido. Se a segunda falhar, fica uma NC orfa E o achado continua
-- "promovivel" -- o proximo clique cria a segunda NC, e o modulo passa a contar
-- o mesmo desvio duas vezes. E o mesmo motivo que levou
-- `salvar_modelo_de_checklist` a virar funcao.
--
-- SECURITY INVOKER: roda com as permissoes de quem chama, entao o RLS das duas
-- tabelas continua valendo. Nao ha escalada de privilegio aqui -- a funcao so
-- serve para as duas escritas caberem numa transacao.
--
-- O MAPEAMENTO NAO ESTA AQUI
--
-- Chega pronto em `p_payload`, montado e testado em
-- src/utils/promocaoDaNcDeInspecao.ts. Decidir em SQL o que vai em cada campo
-- espalharia a regra por dois lugares que ninguem le junto.

CREATE OR REPLACE FUNCTION public.promover_nc_da_inspecao(
  p_nc_inspecao_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_ja_promovida uuid;
  v_nova_nc_id uuid;
BEGIN
  -- FOR UPDATE: dois cliques simultaneos ficam em fila em vez de criarem duas
  -- NCs. A trava do aplicativo nao resolveria isso.
  SELECT empresa_id, nc_sgsst_id
    INTO v_empresa_id, v_ja_promovida
    FROM public.sgsst_inspecoes_nao_conformidades
   WHERE id = p_nc_inspecao_id
   FOR UPDATE;

  -- Nao achou pode ser "nao existe" ou "o RLS escondeu". As duas respostas sao a
  -- mesma para quem chama, e dizer qual delas e vazaria a existencia da linha.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achado de inspeção não encontrado.';
  END IF;

  IF v_ja_promovida IS NOT NULL THEN
    RAISE EXCEPTION 'Este achado já foi promovido para a não conformidade %.', v_ja_promovida;
  END IF;

  INSERT INTO public.sgsst_nao_conformidades (
    empresa_id, projeto_id, area_id, titulo, descricao,
    origem_tipo, origem_id, criticidade, responsavel_id, prazo,
    data_identificacao, created_by
  ) VALUES (
    v_empresa_id,
    (p_payload->>'projeto_id')::uuid,
    NULLIF(p_payload->>'area_id', '')::uuid,
    p_payload->>'titulo',
    p_payload->>'descricao',
    'INSPECAO',
    (p_payload->>'origem_id')::uuid,
    p_payload->>'criticidade',
    NULLIF(p_payload->>'responsavel_id', '')::uuid,
    NULLIF(p_payload->>'prazo', '')::date,
    COALESCE(NULLIF(p_payload->>'data_identificacao', '')::date, CURRENT_DATE),
    auth.uid()
  )
  RETURNING id INTO v_nova_nc_id;

  UPDATE public.sgsst_inspecoes_nao_conformidades
     SET nc_sgsst_id = v_nova_nc_id,
         updated_at = now()
   WHERE id = p_nc_inspecao_id;

  -- UPDATE que o RLS recusa afeta ZERO linhas e NAO devolve erro. Sem esta
  -- checagem, a funcao devolveria um id de NC criada e deixaria o achado sem
  -- marca -- que e exatamente o estado que ela existe para impedir.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível marcar o achado como promovido.';
  END IF;

  RETURN v_nova_nc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promover_nc_da_inspecao(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promover_nc_da_inspecao(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.promover_nc_da_inspecao IS
  'Cria a NC do SGSST a partir de um achado de inspeção e marca o achado como promovido, numa transação. O mapeamento dos campos chega pronto em p_payload (ver src/utils/promocaoDaNcDeInspecao.ts).';
