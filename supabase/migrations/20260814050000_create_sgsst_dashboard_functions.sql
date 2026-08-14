-- Migration: Create SGSST Dashboard Metrics & Alerts Functions

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
        AND status IN ('EM_ANDAMENTO', 'EM_ANALISE')
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
        AND status IN ('PLANEJADA', 'EM_ANDAMENTO')
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
        AND status IN ('REGISTRADO', 'EM_INVESTIGACAO')
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
        AND e.status IN ('PENDENTE', 'SOLICITADO', 'AGENDADO')
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
      'Ocorrência em Investigação [' || COALESCE(inc.codigo, 'INC') || ']' AS titulo,
      inc.titulo || ' (' || inc.tipo || ')' AS subtitulo,
      'ALTA' AS urgencia,
      inc.data_ocorrencia::text AS "dataRef",
      '/medicoes/sgsst/incidentes/' || inc.id AS "linkUrl",
      2 AS ord_urgencia,
      inc.data_ocorrencia AS sort_date
    FROM public.sgsst_incidentes inc
    WHERE inc.empresa_id = p_empresa_id
      AND inc.status IN ('EM_INVESTIGACAO', 'REGISTRADO')
      AND (p_projeto_id IS NULL OR inc.projeto_id = p_projeto_id)
      AND (p_data_inicial IS NULL OR inc.created_at::date >= p_data_inicial)
      AND (p_data_final IS NULL OR inc.created_at::date <= p_data_final)

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
