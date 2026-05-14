CREATE OR REPLACE VIEW public.vw_resumo_financeiro_site_item AS
SELECT 
    s.id as site_id,
    s.projeto_id,
    i.id as item_lpu_id,
    i.codigo as item_codigo,
    i.descricao as item_descricao,
    i.unidade as item_unidade,
    i.preco_unitario as item_preco_unitario,
    COALESCE(p.total_produzido_qtd, 0) as qtd_produzida,
    COALESCE(m.total_medido_qtd, 0) as qtd_medida,
    COALESCE(f.total_faturado_qtd, 0) as qtd_faturada,
    COALESCE(p.total_produzido_qtd, 0) * i.preco_unitario as valor_produzido,
    COALESCE(m.total_medido_qtd, 0) * i.preco_unitario as valor_medido,
    COALESCE(f.total_faturado_qtd, 0) * i.preco_unitario as valor_faturado
FROM 
    sites s
CROSS JOIN 
    itens_lpu i
LEFT JOIN (
    SELECT site_id, item_lpu_id, SUM(quantidade) as total_produzido_qtd
    FROM lancamentos_producao
    GROUP BY site_id, item_lpu_id
) p ON p.site_id = s.id AND p.item_lpu_id = i.id
LEFT JOIN (
    SELECT site_id, item_lpu_id, SUM(quantidade) as total_medido_qtd
    FROM lancamentos_medicao
    GROUP BY site_id, item_lpu_id
) m ON m.site_id = s.id AND m.item_lpu_id = i.id
LEFT JOIN (
    SELECT site_id, item_lpu_id, SUM(quantidade) as total_faturado_qtd
    FROM lancamentos_faturamento
    GROUP BY site_id, item_lpu_id
) f ON f.site_id = s.id AND f.item_lpu_id = i.id
WHERE 
    p.total_produzido_qtd > 0 OR m.total_medido_qtd > 0 OR f.total_faturado_qtd > 0;