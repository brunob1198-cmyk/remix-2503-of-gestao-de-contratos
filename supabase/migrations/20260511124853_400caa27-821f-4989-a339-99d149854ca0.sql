-- FUNÇÃO 1: contar fotos por período e sites
CREATE OR REPLACE FUNCTION public.count_fotos_periodo(
  p_site_ids uuid[],
  p_data_inicio date,
  p_data_fim date
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(df.id)
  FROM diario_fotos df
  INNER JOIN diarios_obra dio ON dio.id = df.diario_id
  WHERE dio.site_id = ANY(p_site_ids)
    AND dio.data BETWEEN p_data_inicio AND p_data_fim;
$$;

-- FUNÇÃO 2: somar produção por período e sites
CREATE OR REPLACE FUNCTION public.sum_producao_periodo(
  p_site_ids uuid[],
  p_data_inicio date,
  p_data_fim date
)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(dp.valor_total), 0)
  FROM diario_producao dp
  INNER JOIN diarios_obra dio ON dio.id = dp.diario_id
  WHERE dio.site_id = ANY(p_site_ids)
    AND dio.data BETWEEN p_data_inicio AND p_data_fim;
$$;

-- FUNÇÃO 3: resumo completo por período (retorna JSON)
CREATE OR REPLACE FUNCTION public.resumo_rdo_periodo(
  p_site_ids uuid[],
  p_data_inicio date,
  p_data_fim date
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_fotos', (
      SELECT COUNT(df.id)
      FROM diario_fotos df
      INNER JOIN diarios_obra dio ON dio.id = df.diario_id
      WHERE dio.site_id = ANY(p_site_ids)
        AND dio.data BETWEEN p_data_inicio AND p_data_fim
    ),
    'total_producao', (
      SELECT COALESCE(SUM(dp.valor_total), 0)
      FROM diario_producao dp
      INNER JOIN diarios_obra dio ON dio.id = dp.diario_id
      WHERE dio.site_id = ANY(p_site_ids)
        AND dio.data BETWEEN p_data_inicio AND p_data_fim
    ),
    'total_dias', (
      SELECT COUNT(DISTINCT dio.data)
      FROM diarios_obra dio
      WHERE dio.site_id = ANY(p_site_ids)
        AND dio.data BETWEEN p_data_inicio AND p_data_fim
    ),
    'total_sites', (
      SELECT COUNT(DISTINCT dio.site_id)
      FROM diarios_obra dio
      WHERE dio.site_id = ANY(p_site_ids)
        AND dio.data BETWEEN p_data_inicio AND p_data_fim
    ),
    'media_por_dia', (
      SELECT COALESCE(
        SUM(dp.valor_total) / NULLIF(COUNT(DISTINCT dio.data), 0),
        0
      )
      FROM diario_producao dp
      INNER JOIN diarios_obra dio ON dio.id = dp.diario_id
      WHERE dio.site_id = ANY(p_site_ids)
        AND dio.data BETWEEN p_data_inicio AND p_data_fim
    )
  );
$$;

-- FUNÇÃO 4: total de produção por item para o dashboard
CREATE OR REPLACE FUNCTION public.sum_producao_por_item(
  p_projeto_ids uuid[]
)
RETURNS TABLE(
  item_lpu_id uuid,
  site_id uuid,
  total_quantidade numeric,
  total_valor numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dp.item_lpu_id,
    dio.site_id,
    SUM(dp.quantidade) as total_quantidade,
    SUM(dp.valor_total) as total_valor
  FROM diario_producao dp
  INNER JOIN diarios_obra dio ON dio.id = dp.diario_id
  INNER JOIN sites s ON s.id = dio.site_id
  WHERE s.projeto_id = ANY(p_projeto_ids)
  GROUP BY dp.item_lpu_id, dio.site_id;
$$;