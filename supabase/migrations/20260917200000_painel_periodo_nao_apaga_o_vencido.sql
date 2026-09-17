-- O filtro de periodo do painel apagava justamente o que estava vencido
--
-- COMO APARECEU
--
-- Roteiro 13.6: "Entregar ate o estoque ficar abaixo do minimo -> aparece o
-- alerta de estoque baixo no painel." O alerta existe. Conferindo por que ele
-- poderia nao aparecer, achei isto.
--
-- O DEFEITO
--
-- `sgsst_dashboard_metrics` recebe p_data_inicial e p_data_final e aplicava a
-- janela em TODAS as 24 metricas, sempre sobre `created_at` da linha.
--
-- Para contagem de evento isso faz sentido. Para ESTADO ATUAL, nao: "ASO
-- vencido", "estoque abaixo do minimo", "CA vencido", "NC em atraso" e
-- "inspecao atrasada" sao situacoes de HOJE, e a linha que as carrega foi criada
-- ANTES. Quanto mais recente o filtro, mais sistematicamente some o que esta
-- irregular -- porque uma coisa vence justamente por ter passado tempo desde que
-- foi criada.
--
-- O filtro removia exatamente o que ele deveria destacar.
--
-- MEDIDO, E NAO DEDUZIDO
--
-- Postgres 16 em container, tabelas reduzidas a partir dos tipos gerados do
-- banco, um ASO criado em 10/2025 com validade vencida ha 5 dias e um EPI criado
-- em 06/2025 com estoque 1, minimo 2 e CA vencido ha 10 dias. Filtrando o painel
-- para 01/09/2026 a 30/09/2026:
--
--                         asosVencidos  estoqueAbaixoMinimo  casVencidos
--   funcao atual .......        0                0                0
--   funcao desta migration      1                1                1
--
-- ISTO NAO MUDA NADA HOJE -- E ESSE E O PONTO
--
-- A tela chama `useSgsstDashboard(projetoId)` sem datas, entao a janela e sempre
-- nula e as contagens saem certas. Medido tambem: sem periodo, as duas versoes
-- devolvem JSON IDENTICO.
--
-- Corrijo agora porque os parametros ja existem na assinatura e no hook: no dia
-- em que alguem ligar um seletor de datas no painel -- cinco minutos de trabalho
-- -- os alertas de atraso vao a zero em silencio, desfazendo as quatro correcoes
-- de painel desta mesma bateria (10.3, 11.5, 3.10 e 17.4). A armadilha esta
-- armada e nao custa nada desarmar antes.
--
-- O QUE MUDA
--
--   * 22 metricas de ESTADO ATUAL perdem a janela de `created_at`;
--   * `inspecoesConcluidas` passa a filtrar por `data_execucao` -- concluida
--     DENTRO do periodo, que e a pergunta que se faz de uma metrica de evento;
--   * `entregasRecentes` fica como estava: ja filtrava por `data_entrega`.
--
-- `sgsst_dashboard_alertas` nao e tocada aqui.

CREATE OR REPLACE FUNCTION public.sgsst_dashboard_metrics(
  p_empresa_id uuid,
  p_projeto_id uuid DEFAULT NULL,
  p_data_inicial date DEFAULT NULL,
  p_data_final date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Trava de tenant: a funcao e SECURITY DEFINER e portanto ignora RLS, entao o
  -- p_empresa_id recebido do cliente precisa ser conferido contra o usuario logado.
  IF p_empresa_id IS NULL
     OR p_empresa_id IS DISTINCT FROM public.get_user_empresa_id(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: empresa_id nao corresponde ao usuario autenticado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'pgrAtivos', (
      SELECT count(*) FROM public.sgsst_pgr
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'aprEmAndamento', (
      SELECT count(*) FROM public.sgsst_apr
      WHERE empresa_id = p_empresa_id
        AND status IN ('EM_ANALISE')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'ptEmExecucao', (
      SELECT count(*) FROM public.sgsst_pt
      WHERE empresa_id = p_empresa_id
        AND status = 'EM_EXECUCAO'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'inspecoesPendentes', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status IN ('PLANEJADA', 'EM_EXECUCAO')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'inspecoesAtrasadas', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status = 'PLANEJADA'
        AND data_planejada < CURRENT_DATE
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'inspecoesConcluidas', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status = 'CONCLUIDA'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR data_execucao >= p_data_inicial)
        AND (p_data_final IS NULL OR data_execucao <= p_data_final)
    ),
    'incidentesAbertos', (
      SELECT count(*) FROM public.sgsst_incidentes
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('ENCERRADO', 'CANCELADO')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'incidentesEmInvestigacao', (
      SELECT count(*) FROM public.sgsst_incidentes
      WHERE empresa_id = p_empresa_id
        AND status = 'EM_INVESTIGACAO'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'naoConformidadesAbertas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'naoConformidadesVencidas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND prazo IS NOT NULL
        AND prazo < CURRENT_DATE
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'naoConformidadesCriticas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND criticidade IN ('ALTA', 'GRAVE', 'CRITICA')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
    ),
    'asosValidos', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade > CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'asosProximosVencimento', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'asosVencidos', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade < CURRENT_DATE
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'examesPendentes', (
      SELECT count(*) FROM public.sgsst_exames e
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = e.colaborador_id
      WHERE e.empresa_id = p_empresa_id
        AND e.status IN ('PENDENTE', 'AGENDADO')
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'treinamentosValidos', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade > CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'treinamentosProximosVencimento', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'treinamentosVencidos', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade < CURRENT_DATE
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'participantesPendentes', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'PENDENTE'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
    ),
    'episAtivos', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
    ),
    'estoqueAbaixoMinimo', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND estoque_atual <= estoque_minimo
    ),
    'casProximosVencimento', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND validade_ca BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
    ),
    'casVencidos', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND validade_ca < CURRENT_DATE
    ),
    'entregasRecentes', (
      SELECT count(*) FROM public.sgsst_epi_entregas ent
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = ent.colaborador_id
      WHERE ent.empresa_id = p_empresa_id
        AND ent.data_entrega >= CURRENT_DATE - interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR ent.data_entrega >= p_data_inicial)
        AND (p_data_final IS NULL OR ent.data_entrega <= p_data_final)
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sgsst_dashboard_metrics TO authenticated;