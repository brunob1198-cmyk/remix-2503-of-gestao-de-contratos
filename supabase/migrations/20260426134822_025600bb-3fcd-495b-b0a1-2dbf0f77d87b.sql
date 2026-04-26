-- 1. Inserir/Atualizar os mapeamentos de categorias baseados na tabela DE-PARA fornecida
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, criado_por_ia, ativo)
VALUES 
    ('Materiais de Construção', 'Materiais', false, true),
    ('Materiais de Elétrica', 'Materiais', false, true),
    ('Material para Obra', 'Materiais', false, true),
    ('Materiais de Hidráulica', 'Materiais', false, true),
    ('Ferramentas', 'Materiais', false, true),
    ('Cimento, Areia e Brita', 'Materiais', false, true),
    ('Tintas e Acabamentos', 'Materiais', false, true),
    ('Equipamentos de Proteção (EPI)', 'Materiais', false, true),
    ('Salários de Operários', 'Mão de Obra', false, true),
    ('Encargos Sociais (FGTS, INSS)', 'Mão de Obra', false, true),
    ('Serviços de Terceiros (Subempreiteiros)', 'Mão de Obra', false, true),
    ('Horas Extras', 'Mão de Obra', false, true),
    ('Adicional Noturno / Periculosidade', 'Mão de Obra', false, true),
    ('Locação de Máquinas', 'Equipamentos', false, true),
    ('Locação de Andaimes', 'Equipamentos', false, true),
    ('Locação de Ferramentas Elétricas', 'Equipamentos', false, true),
    ('Manutenção de Equipamentos', 'Equipamentos', false, true),
    ('Combustível para Máquinas', 'Equipamentos', false, true),
    ('Combustível de Veículos', 'Transporte', false, true),
    ('Fretes e Carretos', 'Transporte', false, true),
    ('Manutenção de Veículos', 'Transporte', false, true),
    ('Pedágios e Estacionamento', 'Transporte', false, true),
    ('Aluguel de Veículos', 'Transporte', false, true),
    ('Aluguel de Container', 'Indiretos', false, true),
    ('Água e Luz da Obra', 'Indiretos', false, true),
    ('Internet e Telefone da Obra', 'Indiretos', false, true),
    ('Limpeza de Obra', 'Indiretos', false, true),
    ('Segurança e Vigilância', 'Indiretos', false, true),
    ('Taxas e Licenças de Obra', 'Financeiros', false, true),
    ('Seguros de Obra', 'Financeiros', false, true),
    ('Juros e Tarifas Bancárias', 'Financeiros', false, true),
    ('Multas', 'Financeiros', false, true)
ON CONFLICT (categoria_erp) 
DO UPDATE SET 
    categoria_interna = EXCLUDED.categoria_interna,
    criado_por_ia = EXCLUDED.criado_por_ia,
    ativo = EXCLUDED.ativo;

-- 2. Atualizar todos os registros de custo_real_erp que já estão lançados
UPDATE public.custo_real_erp c
SET categoria_interna = m.categoria_interna
FROM public.mapeamento_categorias_erp m
WHERE c.categoria_erp = m.categoria_erp;
