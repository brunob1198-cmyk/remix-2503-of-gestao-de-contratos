-- PGR com revisao vencida nao aparecia no painel
--
-- O DEFEITO
--
-- Roteiro 3.10: "Por a data de proxima revisao no passado -> Aparece o aviso de
-- PGR com revisao vencida." O roteiro diz "e voltar ao painel".
--
-- O documento do PGR ja sabia: pgrDocumento.ts calcula a revisao e marca
-- VENCIDO. O painel nao -- `sgsst_pgr` so aparecia na metrica 'pgrAtivos', que
-- conta programas com status ATIVO e nada diz sobre prazo de revisao.
--
-- Nenhum dos oito blocos de alerta era de PGR.
--
-- POR QUE IMPORTA
--
-- O PGR e o documento-raiz do SGSST: o inventario de riscos de onde saem APR,
-- PT, ASO e treinamento. Vencido, ele descreve um canteiro que pode nao existir
-- mais -- e tudo que se apoia nele herda a desatualizacao em silencio.
--
-- Um PGR ATIVO com revisao vencida contava como "PGR ativo" no painel. O numero
-- estava certo e a leitura, errada.
--
-- A REGRA E COPIA FIEL DA DO DOCUMENTO
--
-- base = data_revisao, e na falta dela data_inicio; vencimento = base +
-- periodicidade_revisao_meses; ENCERRADO nao se aplica. E o que
-- src/utils/sgsstPgrRevisao.ts faz. Duas regras parecidas em dois lugares
-- divergem com o tempo, e aqui divergir significa o painel dizer "em dia"
-- enquanto o documento diz "vencido".
--
-- COMO ESTE ARQUIVO FOI PRODUZIDO
--
-- Gerado a partir de 20260916140000 com um unico acrescimo, conferido (a ancora
-- tinha de aparecer exatamente uma vez). O resto das duas funcoes e
-- byte-identico ao que esta em producao.

-- 1. FUNCTION sgsst_dashboard_metrics
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
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'aprEmAndamento', (
      SELECT count(*) FROM public.sgsst_apr
      WHERE empresa_id = p_empresa_id
        AND status IN ('EM_ANALISE')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'ptEmExecucao', (
      SELECT count(*) FROM public.sgsst_pt
      WHERE empresa_id = p_empresa_id
        AND status = 'EM_EXECUCAO'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'inspecoesPendentes', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status IN ('PLANEJADA', 'EM_EXECUCAO')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'inspecoesAtrasadas', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status = 'PLANEJADA'
        AND data_planejada < CURRENT_DATE
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'inspecoesConcluidas', (
      SELECT count(*) FROM public.sgsst_inspecoes
      WHERE empresa_id = p_empresa_id
        AND status = 'CONCLUIDA'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'incidentesAbertos', (
      SELECT count(*) FROM public.sgsst_incidentes
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('ENCERRADO', 'CANCELADO')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'incidentesEmInvestigacao', (
      SELECT count(*) FROM public.sgsst_incidentes
      WHERE empresa_id = p_empresa_id
        AND status = 'EM_INVESTIGACAO'
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'naoConformidadesAbertas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'naoConformidadesVencidas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND prazo IS NOT NULL
        AND prazo < CURRENT_DATE
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'naoConformidadesCriticas', (
      SELECT count(*) FROM public.sgsst_nao_conformidades
      WHERE empresa_id = p_empresa_id
        AND status NOT IN ('CONCLUIDA', 'CANCELADA')
        AND criticidade IN ('ALTA', 'GRAVE', 'CRITICA')
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'asosValidos', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade > CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR a.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR a.created_at::date <= p_data_final)
    ),
    'asosProximosVencimento', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR a.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR a.created_at::date <= p_data_final)
    ),
    'asosVencidos', (
      SELECT count(*) FROM public.sgsst_asos a
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
      WHERE a.empresa_id = p_empresa_id
        AND a.status = 'ATIVO'
        AND a.validade < CURRENT_DATE
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR a.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR a.created_at::date <= p_data_final)
    ),
    'examesPendentes', (
      SELECT count(*) FROM public.sgsst_exames e
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = e.colaborador_id
      WHERE e.empresa_id = p_empresa_id
        AND e.status IN ('PENDENTE', 'AGENDADO')
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR e.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR e.created_at::date <= p_data_final)
    ),
    'treinamentosValidos', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade > CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR tp.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR tp.created_at::date <= p_data_final)
    ),
    'treinamentosProximosVencimento', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR tp.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR tp.created_at::date <= p_data_final)
    ),
    'treinamentosVencidos', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'APROVADO'
        AND tp.validade < CURRENT_DATE
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR tp.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR tp.created_at::date <= p_data_final)
    ),
    'participantesPendentes', (
      SELECT count(*) FROM public.sgsst_treinamentos_participantes tp
      LEFT JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
      WHERE tp.empresa_id = p_empresa_id
        AND tp.resultado = 'PENDENTE'
        AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
        AND (p_data_inicial IS NULL OR tp.created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR tp.created_at::date <= p_data_final)
    ),
    'episAtivos', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'estoqueAbaixoMinimo', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND estoque_atual <= estoque_minimo
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'casProximosVencimento', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND validade_ca BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
    ),
    'casVencidos', (
      SELECT count(*) FROM public.sgsst_epis
      WHERE empresa_id = p_empresa_id
        AND status = 'ATIVO'
        AND validade_ca < CURRENT_DATE
        AND (p_data_inicial IS NULL OR created_at::date >= p_data_inicial)
        AND (p_data_final IS NULL OR created_at::date <= p_data_final)
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


-- 2. FUNCTION sgsst_dashboard_alertas
CREATE OR REPLACE FUNCTION public.sgsst_dashboard_alertas(
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

  WITH combined_alertas AS (
    -- 1. ASOs Vencidos
    SELECT
      'aso-venc-' || a.id AS id,
      'ASO' AS modulo,
      'ASO Vencido: ' || COALESCE(c.nome, p.nome, r.nome, 'Trabalhador') AS titulo,
      'Validade expirada em ' || COALESCE(a.validade::text, 'data n/i') AS subtitulo,
      'CRITICA' AS urgencia,
      a.validade::text AS "dataRef",
      '/medicoes/sgsst/pcmso' AS "linkUrl",
      1 AS ord_urgencia,
      a.validade AS sort_date
    FROM public.sgsst_asos a
    JOIN public.sgsst_colaborador_dados c ON c.id = a.colaborador_id
    LEFT JOIN public.profiles p ON p.id = c.profile_id
    LEFT JOIN public.recursos r ON r.id = c.recurso_id
    WHERE a.empresa_id = p_empresa_id
      AND a.status = 'ATIVO'
      AND a.validade < CURRENT_DATE
      AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR a.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR a.created_at::date <= p_data_final)

    UNION ALL

    -- 2. EPIs com CA Vencido
    SELECT
      'epi-ca-venc-' || e.id AS id,
      'EPI' AS modulo,
      'CA Vencido: ' || e.nome AS titulo,
      'Certificado CA ' || COALESCE(e.ca, '') || ' vencido em ' || e.validade_ca::text AS subtitulo,
      'CRITICA' AS urgencia,
      e.validade_ca::text AS "dataRef",
      '/medicoes/sgsst/epis' AS "linkUrl",
      1 AS ord_urgencia,
      e.validade_ca AS sort_date
    FROM public.sgsst_epis e
    WHERE e.empresa_id = p_empresa_id
      AND e.status = 'ATIVO'
      AND e.validade_ca < CURRENT_DATE
      AND (p_data_inicial IS NULL OR e.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR e.created_at::date <= p_data_final)

    UNION ALL

    -- 3. Não Conformidades Vencidas / Atrasadas
    SELECT
      'nc-venc-' || n.id AS id,
      'NC' AS modulo,
      'Não Conformidade Atrasada [' || COALESCE(n.codigo, 'NC') || ']' AS titulo,
      n.titulo || ' — Prazo excedido em ' || n.prazo::text AS subtitulo,
      'CRITICA' AS urgencia,
      n.prazo::text AS "dataRef",
      '/medicoes/sgsst/nao-conformidades/' || n.id AS "linkUrl",
      1 AS ord_urgencia,
      n.prazo AS sort_date
    FROM public.sgsst_nao_conformidades n
    WHERE n.empresa_id = p_empresa_id
      AND n.status NOT IN ('CONCLUIDA', 'CANCELADA')
      AND n.prazo IS NOT NULL
      AND n.prazo < CURRENT_DATE
      AND (p_projeto_id IS NULL OR n.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR n.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR n.created_at::date <= p_data_final)

    UNION ALL

    -- 3b. Acao corretiva atrasada.
    --
    -- Separado da NC atrasada de proposito: sao prazos diferentes. A NC tem o
    -- seu, cada acao tem o dela, e a acao pode estourar com a NC ainda no prazo.
    -- Enquanto isto nao existia, esse caso nao aparecia em lugar nenhum do
    -- painel: o trabalho corretivo estava atrasado e o resumo dizia que estava
    -- tudo em dia.
    --
    -- Uma linha por acao, e nao um contador por NC: quem vai cobrar precisa
    -- saber QUAL acao venceu e de quem ela e.
    SELECT
      'nc-acao-' || ac.id AS id,
      'NC' AS modulo,
      'Ação corretiva atrasada [' || COALESCE(nc.codigo, 'NC') || ']' AS titulo,
      ac.descricao || ' — prazo era ' || ac.prazo::text AS subtitulo,
      'CRITICA' AS urgencia,
      ac.prazo::text AS "dataRef",
      '/medicoes/sgsst/nao-conformidades/' || nc.id AS "linkUrl",
      1 AS ord_urgencia,
      ac.prazo AS sort_date
    FROM public.sgsst_nao_conformidades_acoes ac
    JOIN public.sgsst_nao_conformidades nc ON nc.id = ac.nao_conformidade_id
    WHERE ac.empresa_id = p_empresa_id
      -- Concluida ou cancelada nao atrasa. Acao sem prazo nao pode atrasar --
      -- a falta do prazo e cobrada no documento da NC, como problema proprio.
      AND ac.status IN ('ABERTA', 'EM_ANDAMENTO')
      AND ac.prazo IS NOT NULL
      AND ac.prazo < CURRENT_DATE
      -- NC ja encerrada nao cobra mais nada, mesmo com acao esquecida em aberto.
      AND nc.status NOT IN ('CONCLUIDA', 'CANCELADA')
      AND (p_projeto_id IS NULL OR nc.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR ac.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR ac.created_at::date <= p_data_final)

    UNION ALL

    -- 4. PTs em Execução Ativa
    SELECT
      'pt-exec-' || p.id AS id,
      'PT' AS modulo,
      'Permissão de Trabalho em Execução [' || COALESCE(p.codigo, 'PT') || ']' AS titulo,
      p.atividade AS subtitulo,
      'ALTA' AS urgencia,
      p.data_inicio::text AS "dataRef",
      '/medicoes/sgsst/pt/' || p.id AS "linkUrl",
      2 AS ord_urgencia,
      p.data_inicio AS sort_date
    FROM public.sgsst_pt p
    WHERE p.empresa_id = p_empresa_id
      AND p.status = 'EM_EXECUCAO'
      AND (p_projeto_id IS NULL OR p.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR p.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR p.created_at::date <= p_data_final)

    UNION ALL

    -- 5. Incidentes em Investigação
    SELECT
      'inc-inv-' || inc.id AS id,
      'INCIDENTE' AS modulo,
      -- Nao diz mais "em Investigacao": o alerta passou a incluir incidente em
      -- PLANO_ACAO e EM_TRATAMENTO, e afirmar o estado errado no titulo e o mesmo
      -- tipo de mentira que o contador zerado contava.
      'Ocorrência em aberto [' || COALESCE(inc.codigo, 'INC') || ']' AS titulo,
      inc.titulo || ' (' || inc.tipo || ')' AS subtitulo,
      'ALTA' AS urgencia,
      inc.data_ocorrencia::text AS "dataRef",
      '/medicoes/sgsst/incidentes/' || inc.id AS "linkUrl",
      2 AS ord_urgencia,
      inc.data_ocorrencia AS sort_date
    FROM public.sgsst_incidentes inc
    WHERE inc.empresa_id = p_empresa_id
      AND inc.status NOT IN ('ENCERRADO', 'CANCELADO')
      AND (p_projeto_id IS NULL OR inc.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR inc.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR inc.created_at::date <= p_data_final)

    UNION ALL

    -- 5b. Acao de tratamento de incidente atrasada.
    --
    -- Irmao do bloco 3b, e pelo mesmo motivo: sao dois prazos distintos. O
    -- incidente nao tem prazo proprio; cada acao de tratamento tem o dela. Sem
    -- este bloco, uma acao vencida de um acidente ja investigado nao aparecia em
    -- lugar nenhum do painel -- o documento do incidente cobrava "N acao(oes)
    -- com prazo vencido", e o resumo nao dizia nada.
    SELECT
      'inc-acao-' || ac.id AS id,
      'INCIDENTE' AS modulo,
      'Ação de tratamento atrasada [' || COALESCE(inc.codigo, 'INC') || ']' AS titulo,
      ac.descricao || ' — prazo era ' || ac.prazo::text AS subtitulo,
      'CRITICA' AS urgencia,
      ac.prazo::text AS "dataRef",
      '/medicoes/sgsst/incidentes/' || inc.id AS "linkUrl",
      1 AS ord_urgencia,
      ac.prazo AS sort_date
    FROM public.sgsst_incidentes_acoes ac
    JOIN public.sgsst_incidentes inc ON inc.id = ac.incidente_id
    WHERE ac.empresa_id = p_empresa_id
      AND ac.status IN ('ABERTA', 'EM_ANDAMENTO')
      AND ac.prazo IS NOT NULL
      AND ac.prazo < CURRENT_DATE
      -- Incidente encerrado ou cancelado nao cobra mais nada, mesmo com acao
      -- esquecida em aberto. Mesmo vocabulario do bloco 5, logo acima.
      AND inc.status NOT IN ('ENCERRADO', 'CANCELADO')
      AND (p_projeto_id IS NULL OR inc.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR ac.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR ac.created_at::date <= p_data_final)

    UNION ALL

    -- 6. Treinamentos Vencidos
    SELECT
      'tr-venc-' || tp.id AS id,
      'TREINAMENTO' AS modulo,
      'Reciclagem Vencida: ' || COALESCE(tr.nome, 'Treinamento') AS titulo,
      'Colaborador: ' || COALESCE(c.nome, p.nome, r.nome, 'Trabalhador') || ' | Expired: ' || tp.validade::text AS subtitulo,
      'MEDIA' AS urgencia,
      tp.validade::text AS "dataRef",
      '/medicoes/sgsst/treinamentos' AS "linkUrl",
      3 AS ord_urgencia,
      tp.validade AS sort_date
    FROM public.sgsst_treinamentos_participantes tp
    JOIN public.sgsst_treinamentos_turmas tur ON tur.id = tp.turma_id
    JOIN public.sgsst_treinamentos tr ON tr.id = tur.treinamento_id
    JOIN public.sgsst_colaborador_dados c ON c.id = tp.colaborador_id
    LEFT JOIN public.profiles p ON p.id = c.profile_id
    LEFT JOIN public.recursos r ON r.id = c.recurso_id
    WHERE tp.empresa_id = p_empresa_id
      AND tp.resultado = 'APROVADO'
      AND tp.validade < CURRENT_DATE
      AND (p_projeto_id IS NULL OR c.projeto_id = p_projeto_id OR tr.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR tp.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR tp.created_at::date <= p_data_final)

    UNION ALL

    -- 7. Estoque EPI Abaixo do Mínimo
    SELECT
      'epi-est-' || e.id AS id,
      'EPI' AS modulo,
      'Estoque Crítico de EPI: ' || e.nome AS titulo,
      'Saldo: ' || e.estoque_atual::text || ' ' || COALESCE(e.unidade_medida, 'un') || ' (Mín: ' || e.estoque_minimo::text || ')' AS subtitulo,
      'MEDIA' AS urgencia,
      e.created_at::date::text AS "dataRef",
      '/medicoes/sgsst/epis' AS "linkUrl",
      3 AS ord_urgencia,
      e.created_at::date AS sort_date
    FROM public.sgsst_epis e
    WHERE e.empresa_id = p_empresa_id
      AND e.status = 'ATIVO'
      AND e.estoque_atual <= e.estoque_minimo
      AND (p_data_inicial IS NULL OR e.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR e.created_at::date <= p_data_final)

    UNION ALL

    -- 9. PGR com revisao vencida.
    --
    -- A REGRA E A MESMA DO DOCUMENTO, DE PROPOSITO
    --
    -- src/utils/sgsstPgrRevisao.ts calcula: base = data_revisao, e na falta dela
    -- data_inicio; vencimento = base + periodicidade; ENCERRADO nao se aplica.
    -- O SQL abaixo repete isso literalmente. Duas regras parecidas em dois
    -- lugares divergem com o tempo -- foi o que aconteceu com os status dos
    -- incidentes -- e aqui o preco de divergir e o painel dizer que o PGR esta em
    -- dia enquanto o documento o marca vencido.
    --
    -- Avisa so DEPOIS de vencer, como todos os outros blocos deste UNION. O
    -- modulo TS tem uma janela de 90 dias (VENCE_EM_BREVE) que nao virou alerta:
    -- seria decisao de produto, nao correcao.
    SELECT
      'pgr-rev-' || pg.id AS id,
      'PGR' AS modulo,
      'PGR com revisão vencida [' || COALESCE(pg.codigo, 'PGR') || ']' AS titulo,
      pg.titulo || ' — revisão vencida em ' || v.vencimento::text AS subtitulo,
      'CRITICA' AS urgencia,
      v.vencimento::text AS "dataRef",
      '/medicoes/sgsst/pgr/' || pg.id AS "linkUrl",
      1 AS ord_urgencia,
      v.vencimento AS sort_date
    FROM public.sgsst_pgr pg
    CROSS JOIN LATERAL (
      SELECT (
        COALESCE(pg.data_revisao, pg.data_inicio)
          + (COALESCE(pg.periodicidade_revisao_meses, 24) || ' months')::interval
      )::date AS vencimento
    ) v
    WHERE pg.empresa_id = p_empresa_id
      -- PGR encerrado nao tem revisao a vencer.
      AND pg.status <> 'ENCERRADO'
      AND v.vencimento < CURRENT_DATE
      AND (p_projeto_id IS NULL OR pg.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR pg.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR pg.created_at::date <= p_data_final)

    UNION ALL

    -- 8. Inspecoes atrasadas: planejadas, a data passou e ninguem executou.
    --
    -- Inspecao nao aparecia no painel de alertas de forma alguma. Uma auditoria de
    -- campo planejada para ontem e nao feita nao gerava aviso nenhum, enquanto ASO,
    -- EPI, PT e nao conformidade todos geravam.
    --
    -- Nao entra aqui a inspecao EM_EXECUCAO com data vencida: alguem esta fazendo, e
    -- juntar as duas faria o gestor cobrar quem trabalha e perder de vista quem nem
    -- comecou. So a nao iniciada e alerta.
    SELECT
      'insp-atras-' || i.id AS id,
      'INSPECAO' AS modulo,
      'Inspecao atrasada: ' || COALESCE(i.codigo, i.titulo) AS titulo,
      'Planejada para ' || i.data_planejada::text
        || ' (' || (CURRENT_DATE - i.data_planejada)::text || ' dia(s) de atraso)' AS subtitulo,
      -- ALTA e nao CRITICA: a inspecao atrasada indica risco NAO VERIFICADO, o que e
      -- diferente de um risco confirmado como ASO vencido ou EPI com CA expirado.
      -- Igualar as duas faria o topo da lista perder a ordem de gravidade.
      'ALTA' AS urgencia,
      i.data_planejada::text AS "dataRef",
      '/medicoes/sgsst/inspecoes' AS "linkUrl",
      2 AS ord_urgencia,
      i.data_planejada AS sort_date
    FROM public.sgsst_inspecoes i
    WHERE i.empresa_id = p_empresa_id
      AND i.status = 'PLANEJADA'
      AND i.data_planejada < CURRENT_DATE
      AND (p_projeto_id IS NULL OR i.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR i.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR i.created_at::date <= p_data_final)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'modulo', modulo,
        'titulo', titulo,
        'subtitulo', subtitulo,
        'urgencia', urgencia,
        'dataRef', "dataRef",
        'linkUrl', "linkUrl"
      )
    ),
    '[]'::jsonb
  )
  INTO result
  FROM (
    SELECT *
    FROM combined_alertas
    ORDER BY ord_urgencia ASC, sort_date ASC
    LIMIT 15
  ) sub;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sgsst_dashboard_alertas TO authenticated;
