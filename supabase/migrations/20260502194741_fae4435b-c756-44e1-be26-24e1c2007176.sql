-- Drop and recreate the view with better logic
CREATE OR REPLACE VIEW public.view_bi_producao AS
 WITH consolidated_production AS (
         -- 1. Source: RDO (Diário de Obra)
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
        
         -- 2. Source: Manual Entries (Medição)
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
                   FROM diario_producao dp2
                     JOIN diarios_obra d2 ON d2.id = dp2.diario_id
                  WHERE d2.site_id = lm.site_id 
                    AND date_trunc('month'::text, d2.data::timestamp with time zone) = date_trunc('month'::text, lm.data_medicao::timestamp with time zone)
                ))
                
        UNION ALL
        
         -- 3. Source: Production Entries (Other Manual)
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
                   FROM diario_producao dp3
                     JOIN diarios_obra d3 ON d3.id = dp3.diario_id
                  WHERE d3.site_id = lp.site_id 
                    AND date_trunc('month'::text, d3.data::timestamp with time zone) = date_trunc('month'::text, lp.data_producao::timestamp with time zone)
                )) 
                AND NOT (EXISTS ( 
                   SELECT 1
                   FROM lancamentos_medicao lm2
                  WHERE lm2.site_id = lp.site_id 
                    AND date_trunc('month'::text, lm2.data_medicao::timestamp with time zone) = date_trunc('month'::text, lp.data_producao::timestamp with time zone)
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