-- Primeiro, garantir que as regras na tabela de mapeamento estejam corretas
-- Materiais
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, ativo, criado_por_ia)
VALUES 
('Materiais de Construção', 'Materiais', true, false),
('Materiais de Elétrica', 'Materiais', true, false),
('Material para Obra', 'Materiais', true, false),
('Materiais de Hidráulica', 'Materiais', true, false),
('Ferramentas', 'Materiais', true, false),
('Cimento, Areia e Brita', 'Materiais', true, false),
('Tintas e Acabamentos', 'Materiais', true, false),
('Equipamentos de Proteção (EPI)', 'Materiais', true, false)
ON CONFLICT (categoria_erp) DO UPDATE SET categoria_interna = EXCLUDED.categoria_interna, ativo = true;

-- Mão de Obra
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, ativo, criado_por_ia)
VALUES 
('Salários de Operários', 'Mão de Obra', true, false),
('Encargos Sociais (FGTS, INSS)', 'Mão de Obra', true, false),
('Serviços de Terceiros (Subempreiteiros)', 'Mão de Obra', true, false),
('Horas Extras', 'Mão de Obra', true, false),
('Adicionais (Insalubridade, Periculosidade)', 'Mão de Obra', true, false),
('Vale Transporte / Refeição (Operacional)', 'Mão de Obra', true, false)
ON CONFLICT (categoria_erp) DO UPDATE SET categoria_interna = EXCLUDED.categoria_interna, ativo = true;

-- Equipamentos
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, ativo, criado_por_ia)
VALUES 
('Locação de Máquinas (Escavadeiras, Munck)', 'Equipamentos', true, false),
('Locação de Andaimes', 'Equipamentos', true, false),
('Manutenção de Máquinas e Equipamentos', 'Equipamentos', true, false),
('Combustível para Máquinas', 'Equipamentos', true, false),
('Locação de Pequenos Equipamentos (Betoneiras)', 'Equipamentos', true, false)
ON CONFLICT (categoria_erp) DO UPDATE SET categoria_interna = EXCLUDED.categoria_interna, ativo = true;

-- Transporte
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, ativo, criado_por_ia)
VALUES 
('Fretes e Carretos', 'Transporte', true, false),
('Combustível - Campo', 'Transporte', true, false),
('Manutenção de Veículos da Obra', 'Transporte', true, false),
('Pedágios e Estacionamentos (Obra)', 'Transporte', true, false),
('Viagens e Hospedagens (Equipe de Obra)', 'Transporte', true, false)
ON CONFLICT (categoria_erp) DO UPDATE SET categoria_interna = EXCLUDED.categoria_interna, ativo = true;

-- Indiretos
INSERT INTO public.mapeamento_categorias_erp (categoria_erp, categoria_interna, ativo, criado_por_ia)
VALUES 
('Aluguel de Canteiro / Escritório', 'Indiretos', true, false),
('Energia Elétrica e Água (Canteiro)', 'Indiretos', true, false),
('Internet e Telefonia (Obra)', 'Indiretos', true, false),
('Limpeza e Conservação', 'Indiretos', true, false),
('Seguros da Obra', 'Indiretos', true, false),
('Taxas e Impostos (Alvarás, ISS)', 'Indiretos', true, false),
('Material de Escritório (Obra)', 'Indiretos', true, false)
ON CONFLICT (categoria_erp) DO UPDATE SET categoria_interna = EXCLUDED.categoria_interna, ativo = true;

-- Agora, atualizar todos os lançamentos existentes na tabela custo_real_erp
-- Usamos um JOIN com a tabela de mapeamento para garantir a sincronia
UPDATE public.custo_real_erp c
SET categoria_interna = m.categoria_interna
FROM public.mapeamento_categorias_erp m
WHERE c.categoria_erp = m.categoria_erp;

-- Garantir especificamente casos como o mencionado pelo usuário (Combustivel - Campo)
-- Caso o mapeamento acima não tenha sido suficiente por algum detalhe de string
UPDATE public.custo_real_erp
SET categoria_interna = 'Transporte'
WHERE categoria_erp ILIKE '%Combustivel%Campo%';
