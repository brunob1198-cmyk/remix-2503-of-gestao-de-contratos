-- Limpeza de políticas existentes para evitar erros de duplicidade
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projetos', 'sites', 'lancamentos_medicao', 'lancamentos_producao', 'faturamentos', 'diarios_obra', 'escopo_itens')) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 1. Ativar RLS em todas as tabelas críticas
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarios_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escopo_itens ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para PROJETOS (Tabela âncora com empresa_id direto)
CREATE POLICY "projeto_select" ON public.projetos FOR SELECT TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "projeto_modify" ON public.projetos FOR ALL TO authenticated
USING (
    empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 3. Políticas para SITES
CREATE POLICY "site_select" ON public.sites FOR SELECT TO authenticated
USING (projeto_id IN (SELECT id FROM public.projetos));

CREATE POLICY "site_modify" ON public.sites FOR ALL TO authenticated
USING (
    projeto_id IN (SELECT id FROM public.projetos) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    projeto_id IN (SELECT id FROM public.projetos) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 4. Políticas para LANCAMENTOS_MEDICAO
CREATE POLICY "medicao_select" ON public.lancamentos_medicao FOR SELECT TO authenticated
USING (site_id IN (SELECT id FROM public.sites));

CREATE POLICY "medicao_modify" ON public.lancamentos_medicao FOR ALL TO authenticated
USING (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 5. Políticas para LANCAMENTOS_PRODUCAO
CREATE POLICY "producao_select" ON public.lancamentos_producao FOR SELECT TO authenticated
USING (site_id IN (SELECT id FROM public.sites));

CREATE POLICY "producao_modify" ON public.lancamentos_producao FOR ALL TO authenticated
USING (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 6. Políticas para FATURAMENTOS
CREATE POLICY "faturamento_select" ON public.faturamentos FOR SELECT TO authenticated
USING (projeto_id IN (SELECT id FROM public.projetos));

CREATE POLICY "faturamento_modify" ON public.faturamentos FOR ALL TO authenticated
USING (
    projeto_id IN (SELECT id FROM public.projetos) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    projeto_id IN (SELECT id FROM public.projetos) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 7. Políticas para DIARIOS_OBRA
CREATE POLICY "diario_select" ON public.diarios_obra FOR SELECT TO authenticated
USING (site_id IN (SELECT id FROM public.sites));

CREATE POLICY "diario_modify" ON public.diarios_obra FOR ALL TO authenticated
USING (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);

-- 8. Políticas para ESCOPO_ITENS
CREATE POLICY "escopo_select" ON public.escopo_itens FOR SELECT TO authenticated
USING (site_id IN (SELECT id FROM public.sites));

CREATE POLICY "escopo_modify" ON public.escopo_itens FOR ALL TO authenticated
USING (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
)
WITH CHECK (
    site_id IN (SELECT id FROM public.sites) AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'interno'))
);
