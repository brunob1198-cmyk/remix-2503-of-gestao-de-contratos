CREATE OR REPLACE VIEW public.view_bi_producao AS
 WITH consolidated_production AS (
         SELECT dp.id,
            d.data AS data_producao,
            d.site_id,
            s.codigo AS site_codigo,
            s.nome AS site_nome,
            p.id AS projeto_id,
            p.codigo AS projeto_codigo,
            p.nome AS projeto_nome,
            p.area_id,
            a.nome AS area_nome,
            il.id AS item_lpu_id,
            il.codigo AS item_codigo,
            il.descricao AS item_descricao,
            il.unidade,
            dp.quantidade,
            dp.preco_unitario_congelado,
            dp.valor_total,
            d.clima,
            d.uf,
            d.municipio,
            'diario'::text AS origem
           FROM diario_producao dp
             JOIN diarios_obra d ON d.id = dp.diario_id
             JOIN sites s ON s.id = d.site_id
             JOIN projetos p ON p.id = s.projeto_id
             LEFT JOIN areas a ON a.id = p.area_id
             JOIN itens_lpu il ON il.id = dp.item_lpu_id
        UNION ALL
         SELECT lm.id,
            lm.data_medicao AS data_producao,
            lm.site_id,
            s.codigo AS site_codigo,
            s.nome AS site_nome,
            p.id AS projeto_id,
            p.codigo AS projeto_codigo,
            p.nome AS projeto_nome,
            p.area_id,
            a.nome AS area_nome,
            il.id AS item_lpu_id,
            il.codigo AS item_codigo,
            il.descricao AS item_descricao,
            il.unidade,
            lm.quantidade,
            il.preco_unitario AS preco_unitario_congelado,
            lm.quantidade * il.preco_unitario AS valor_total,
            NULL::text AS clima,
            s.uf,
            s.municipio,
            'manual'::text AS origem
           FROM lancamentos_medicao lm
             JOIN sites s ON s.id = lm.site_id
             JOIN projetos p ON p.id = s.projeto_id
             LEFT JOIN areas a ON a.id = p.area_id
             JOIN itens_lpu il ON il.id = lm.item_lpu_id
          WHERE NOT (EXISTS ( 
                   SELECT 1
                   FROM diarios_obra d2
                   JOIN sites s2 ON s2.id = d2.site_id
                   WHERE s2.projeto_id = p.id 
                     AND date_trunc('month', d2.data) = date_trunc('month', lm.data_medicao)
                ))
        UNION ALL
         SELECT lp.id,
            lp.data_producao,
            lp.site_id,
            s.codigo AS site_codigo,
            s.nome AS site_nome,
            p.id AS projeto_id,
            p.codigo AS projeto_codigo,
            p.nome AS projeto_nome,
            p.area_id,
            a.nome AS area_nome,
            il.id AS item_lpu_id,
            il.codigo AS item_codigo,
            il.descricao AS item_descricao,
            il.unidade,
            lp.quantidade,
            il.preco_unitario AS preco_unitario_congelado,
            lp.quantidade * il.preco_unitario AS valor_total,
            NULL::text AS clima,
            s.uf,
            s.municipio,
            'lancamento'::text AS origem
           FROM lancamentos_producao lp
             JOIN sites s ON s.id = lp.site_id
             JOIN projetos p ON p.id = s.projeto_id
             LEFT JOIN areas a ON a.id = p.area_id
             JOIN itens_lpu il ON il.id = lp.item_lpu_id
          WHERE NOT (EXISTS ( 
                   SELECT 1
                   FROM diarios_obra d3
                   JOIN sites s3 ON s3.id = d3.site_id
                   WHERE s3.projeto_id = p.id 
                     AND date_trunc('month', d3.data) = date_trunc('month', lp.data_producao)
                )) 
            AND NOT (EXISTS ( 
                   SELECT 1
                   FROM lancamentos_medicao lm2
                   JOIN sites s4 ON s4.id = lm2.site_id
                   WHERE s4.projeto_id = p.id 
                     AND date_trunc('month', lm2.data_medicao) = date_trunc('month', lp.data_producao)
                ))
        )
 SELECT id,
    data_producao,
    site_id,
    site_codigo,
    site_nome,
    projeto_id,
    projeto_codigo,
    projeto_nome,
    area_id,
    area_nome,
    item_lpu_id,
    item_codigo,
    item_descricao,
    unidade,
    quantidade,
    preco_unitario_congelado,
    valor_total,
    clima,
    uf,
    municipio,
    origem,
    EXTRACT(year FROM data_producao)::integer AS ano,
    EXTRACT(month FROM data_producao)::integer AS mes
   FROM consolidated_production;