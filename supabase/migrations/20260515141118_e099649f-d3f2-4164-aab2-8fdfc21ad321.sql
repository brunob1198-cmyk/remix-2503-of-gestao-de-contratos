-- Atualizar view_bi_dim_categoria
CREATE OR REPLACE VIEW public.view_bi_dim_categoria AS
 WITH raw_data AS (
         SELECT m.id,
            m.categoria_erp,
            m.categoria_interna,
            m.ativo
           FROM mapeamento_categorias_erp m
        UNION
         SELECT gen_random_uuid() AS id,
            c.categoria_erp,
            c.categoria_interna,
            true AS ativo
           FROM custo_real_erp c
          WHERE NOT (EXISTS ( SELECT 1
                   FROM mapeamento_categorias_erp m
                  WHERE m.categoria_erp = c.categoria_erp))
        ), ranked_data AS (
         SELECT raw_data.id,
            raw_data.categoria_erp,
            raw_data.categoria_interna,
            raw_data.ativo,
            row_number() OVER (PARTITION BY (lower(raw_data.categoria_erp)) ORDER BY raw_data.id) AS rn
           FROM raw_data
          WHERE raw_data.categoria_erp IS NOT NULL AND trim(raw_data.categoria_erp) <> ''
        )
 SELECT id,
    categoria_erp,
    categoria_interna,
    ativo
   FROM ranked_data
  WHERE rn = 1;

-- Atualizar view_bi_analise_obras
CREATE OR REPLACE VIEW public.view_bi_analise_obras AS
 WITH meses AS (
         SELECT DISTINCT first_of_month(x.d) AS mes
           FROM ( SELECT custo_real_erp.data_competencia AS d
                   FROM custo_real_erp
                UNION ALL
                 SELECT vbp.data_producao AS d
                   FROM view_bi_producao vbp
                UNION ALL
                 SELECT faturamentos.data_emissao AS d
                   FROM faturamentos) x
          WHERE x.d IS NOT NULL
        ), projetos_base AS (
         SELECT p.id AS projeto_id,
            p.codigo AS projeto_codigo,
            p.nome AS projeto_nome,
            p.status AS projeto_status,
            p.valor_total AS projeto_valor_total,
            p.empresa_id,
            e.nome AS empresa_nome,
            p.area_id,
            a.nome AS area_nome,
            p.cliente_id,
            c.razao_social AS cliente_razao_social,
            c.cnpj AS cliente_cnpj
           FROM projetos p
             LEFT JOIN empresas e ON e.id = p.empresa_id
             LEFT JOIN areas a ON a.id = p.area_id
             LEFT JOIN clientes c ON c.id = p.cliente_id
        ), producao_mes AS (
         SELECT vbp.projeto_id,
            first_of_month(vbp.data_producao) AS mes,
            sum(vbp.valor_total) AS producao_valor,
            sum(vbp.quantidade) AS producao_quantidade,
            count(DISTINCT vbp.id) FILTER (WHERE vbp.origem = 'diario'::text) AS dias_com_diario
           FROM view_bi_producao vbp
          GROUP BY vbp.projeto_id, (first_of_month(vbp.data_producao))
        ), custo_mes_detalhado AS (
         SELECT cre.projeto_id,
            first_of_month(cre.data_competencia) AS mes,
            cre.categoria_erp,
            COALESCE(cre.categoria_interna, mce.categoria_interna, 'Sem Categoria') AS categoria_interna,
            cre.categoria_sugerida_ia AS categoria_ia,
            sum(cre.valor) AS custo_erp_total
           FROM custo_real_erp cre
             LEFT JOIN mapeamento_categorias_erp mce ON mce.categoria_erp = cre.categoria_erp
          WHERE COALESCE(mce.ativo, true) = true 
            AND cre.categoria_erp IS NOT NULL 
            AND trim(cre.categoria_erp) <> ''
            AND COALESCE(cre.categoria_interna, mce.categoria_interna) <> 'Equipamentos'
          GROUP BY cre.projeto_id, (first_of_month(cre.data_competencia)), cre.categoria_erp, COALESCE(cre.categoria_interna, mce.categoria_interna, 'Sem Categoria'), cre.categoria_sugerida_ia
        ), faturamento_mes AS (
         SELECT faturamentos.projeto_id,
            first_of_month(faturamentos.data_emissao) AS mes,
            sum(faturamentos.valor_bruto) AS faturamento_bruto,
            sum(faturamentos.valor_liquido) AS faturamento_liquido,
            count(*) AS faturas_qtd
           FROM faturamentos
          GROUP BY faturamentos.projeto_id, (first_of_month(faturamentos.data_emissao))
        ), all_data AS (
         SELECT cmd.projeto_id,
            cmd.mes,
            cmd.categoria_erp,
            cmd.categoria_interna,
            cmd.categoria_ia
           FROM custo_mes_detalhado cmd
        UNION
         SELECT pm.projeto_id,
            pm.mes,
            'PRODUCAO' AS categoria_erp,
            'Produção' AS categoria_interna,
            NULL::text AS categoria_ia
           FROM producao_mes pm
        UNION
         SELECT fm.projeto_id,
            fm.mes,
            'FATURAMENTO' AS categoria_erp,
            'Faturamento' AS categoria_interna,
            NULL::text AS categoria_ia
           FROM faturamento_mes fm
        )
 SELECT pb.projeto_id,
    pb.projeto_codigo,
    pb.projeto_nome,
    pb.projeto_status,
    pb.projeto_valor_total,
    pb.empresa_id,
    pb.empresa_nome,
    pb.area_id,
    pb.area_nome,
    pb.cliente_id,
    pb.cliente_razao_social,
    pb.cliente_cnpj,
    ad.mes,
    COALESCE(ad.categoria_erp, 'N/A') AS categoria_erp,
    COALESCE(ad.categoria_interna, 'N/A') AS categoria_interna,
    COALESCE(ad.categoria_ia, 'N/A') AS categoria_ia,
    COALESCE(cmd.custo_erp_total, 0::numeric) AS custo_erp_total,
    COALESCE(pm.producao_valor, 0::numeric) AS producao_valor,
    COALESCE(pm.producao_quantidade, 0::numeric) AS producao_quantidade,
    COALESCE(pm.dias_com_diario, 0::bigint) AS dias_com_diario,
    COALESCE(fm.faturamento_bruto, 0::numeric) AS faturamento_bruto,
    COALESCE(fm.faturamento_liquido, 0::numeric) AS faturamento_liquido,
    COALESCE(fm.faturas_qtd, 0::bigint) AS faturas_qtd
   FROM all_data ad
     JOIN projetos_base pb ON pb.projeto_id = ad.projeto_id
     LEFT JOIN producao_mes pm ON pm.projeto_id = ad.projeto_id AND pm.mes = ad.mes
     LEFT JOIN custo_mes_detalhado cmd ON cmd.projeto_id = ad.projeto_id AND cmd.mes = ad.mes AND cmd.categoria_erp = ad.categoria_erp
     LEFT JOIN faturamento_mes fm ON fm.projeto_id = ad.projeto_id AND fm.mes = ad.mes;