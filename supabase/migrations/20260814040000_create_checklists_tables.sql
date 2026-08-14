-- Migration: Create Intelligent Checklists Module Tables (Modelos, Seções, Itens, Aplicações, Respostas, Evidências R2, Planos de Ação 5W2H)

-- 1. TABELA checklist_modelos
CREATE TABLE IF NOT EXISTS public.checklist_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'Geral',
  descricao text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'rascunho')),
  periodicidade_sugerida text DEFAULT 'Diario',
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  tipo_aplicacao text DEFAULT 'Geral',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABELA checklist_secoes
CREATE TABLE IF NOT EXISTS public.checklist_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  modelo_id uuid NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TABELA checklist_itens
CREATE TABLE IF NOT EXISTS public.checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  secao_id uuid NOT NULL REFERENCES public.checklist_secoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo_resposta text NOT NULL DEFAULT 'Conforme_NaoConforme' CHECK (
    tipo_resposta IN (
      'Sim_Nao', 'Conforme_NaoConforme', 'Conforme_NaoConforme_NA', 'Sim_Nao_NA',
      'OK_NaoOK', 'Escala', 'Numero', 'Texto', 'Data', 'Hora', 'Selecao', 'MultiplaSelecao'
    )
  ),
  opcoes_selecao text[],
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 1,
  exigir_comentario_nao_conforme boolean NOT NULL DEFAULT true,
  exigir_foto_nao_conforme boolean NOT NULL DEFAULT false,
  gerar_plano_acao_nao_conforme boolean NOT NULL DEFAULT true,
  peso_pontuacao numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. TABELA checklist_regras
CREATE TABLE IF NOT EXISTS public.checklist_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.checklist_itens(id) ON DELETE CASCADE,
  resposta_gatilho text NOT NULL,
  acao_regra text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TABELA checklist_aplicacoes
CREATE TABLE IF NOT EXISTS public.checklist_aplicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  modelo_id uuid NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE RESTRICT,
  codigo text,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'reaberto', 'cancelado')),
  aplicador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  colaborador_id uuid REFERENCES public.sgsst_colaborador_dados(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.sgsst_funcoes(id) ON DELETE SET NULL,
  pgr_id uuid REFERENCES public.sgsst_pgr(id) ON DELETE SET NULL,
  apr_id uuid REFERENCES public.sgsst_apr(id) ON DELETE SET NULL,
  pt_id uuid REFERENCES public.sgsst_pt(id) ON DELETE SET NULL,
  inspecao_id uuid REFERENCES public.sgsst_inspecoes(id) ON DELETE SET NULL,
  incidente_id uuid REFERENCES public.sgsst_incidentes(id) ON DELETE SET NULL,
  nao_conformidade_id uuid REFERENCES public.sgsst_nao_conformidades(id) ON DELETE SET NULL,
  data_aplicacao timestamptz DEFAULT now(),
  data_conclusao timestamptz,
  pontuacao_obtida numeric DEFAULT 0,
  pontuacao_maxima numeric DEFAULT 0,
  percentual_conformidade numeric DEFAULT 0,
  total_itens integer DEFAULT 0,
  total_conforme integer DEFAULT 0,
  total_nao_conforme integer DEFAULT 0,
  total_na integer DEFAULT 0,
  observacoes_gerais text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. TABELA checklist_respostas
CREATE TABLE IF NOT EXISTS public.checklist_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  aplicacao_id uuid NOT NULL REFERENCES public.checklist_aplicacoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_itens(id) ON DELETE RESTRICT,
  resposta_valor text NOT NULL,
  comentario text,
  is_critico boolean DEFAULT false,
  is_nao_conforme boolean DEFAULT false,
  pontos_obtidos numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. TABELA checklist_evidencias
CREATE TABLE IF NOT EXISTS public.checklist_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  aplicacao_id uuid NOT NULL REFERENCES public.checklist_aplicacoes(id) ON DELETE CASCADE,
  resposta_id uuid REFERENCES public.checklist_respostas(id) ON DELETE CASCADE,
  r2_url text NOT NULL,
  r2_key text,
  nome_arquivo text,
  tipo_mime text,
  tamanho integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. TABELA checklist_planos_acao
CREATE TABLE IF NOT EXISTS public.checklist_planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  aplicacao_id uuid NOT NULL REFERENCES public.checklist_aplicacoes(id) ON DELETE CASCADE,
  resposta_id uuid REFERENCES public.checklist_respostas(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.checklist_itens(id) ON DELETE SET NULL,
  codigo text,
  o_que_fazer text NOT NULL,
  por_que text,
  onde text,
  quando_prazo date,
  quem_responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  como_fazer text,
  quanto_custo numeric,
  prioridade text NOT NULL DEFAULT 'Media' CHECK (prioridade IN ('Baixa', 'Media', 'Alta', 'Critica')),
  status text NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Em_Andamento', 'Concluido', 'Atrasado', 'Cancelado')),
  evidencia_conclusao_r2_url text,
  data_conclusao date,
  validado_por_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_validacao timestamptz,
  nao_conformidade_sgsst_id uuid REFERENCES public.sgsst_nao_conformidades(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- INDICES PARA DESEMPENHO E RLS
CREATE INDEX IF NOT EXISTS idx_checklist_mod_empresa ON public.checklist_modelos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sec_modelo ON public.checklist_secoes(modelo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_secao ON public.checklist_itens(secao_id);
CREATE INDEX IF NOT EXISTS idx_checklist_apl_empresa ON public.checklist_aplicacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_checklist_apl_modelo ON public.checklist_aplicacoes(modelo_id);
CREATE INDEX IF NOT EXISTS idx_checklist_resp_apl ON public.checklist_respostas(aplicacao_id);
CREATE INDEX IF NOT EXISTS idx_checklist_evid_resp ON public.checklist_evidencias(resposta_id);
CREATE INDEX IF NOT EXISTS idx_checklist_plano_apl ON public.checklist_planos_acao(aplicacao_id);

-- RLS PARA TODAS AS 8 TABELAS
ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_aplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_planos_acao ENABLE ROW LEVEL SECURITY;

-- POLICIES MODELOS
CREATE POLICY "Users view own empresa checklist_modelos" ON public.checklist_modelos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_modelos" ON public.checklist_modelos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_modelos" ON public.checklist_modelos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_modelos" ON public.checklist_modelos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES SECOES
CREATE POLICY "Users view own empresa checklist_secoes" ON public.checklist_secoes FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_secoes" ON public.checklist_secoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_secoes" ON public.checklist_secoes FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_secoes" ON public.checklist_secoes FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES ITENS
CREATE POLICY "Users view own empresa checklist_itens" ON public.checklist_itens FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_itens" ON public.checklist_itens FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_itens" ON public.checklist_itens FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_itens" ON public.checklist_itens FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES REGRAS
CREATE POLICY "Users view own empresa checklist_regras" ON public.checklist_regras FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_regras" ON public.checklist_regras FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_regras" ON public.checklist_regras FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_regras" ON public.checklist_regras FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES APLICACOES
CREATE POLICY "Users view own empresa checklist_aplicacoes" ON public.checklist_aplicacoes FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_aplicacoes" ON public.checklist_aplicacoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_aplicacoes" ON public.checklist_aplicacoes FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_aplicacoes" ON public.checklist_aplicacoes FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES RESPOSTAS
CREATE POLICY "Users view own empresa checklist_respostas" ON public.checklist_respostas FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_respostas" ON public.checklist_respostas FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_respostas" ON public.checklist_respostas FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_respostas" ON public.checklist_respostas FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES EVIDENCIAS
CREATE POLICY "Users view own empresa checklist_evidencias" ON public.checklist_evidencias FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_evidencias" ON public.checklist_evidencias FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_evidencias" ON public.checklist_evidencias FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_evidencias" ON public.checklist_evidencias FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- POLICIES PLANOS DE ACAO
CREATE POLICY "Users view own empresa checklist_planos_acao" ON public.checklist_planos_acao FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users insert own empresa checklist_planos_acao" ON public.checklist_planos_acao FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users update own empresa checklist_planos_acao" ON public.checklist_planos_acao FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid())) WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Users delete own empresa checklist_planos_acao" ON public.checklist_planos_acao FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- AUDIT TRIGGERS
DROP TRIGGER IF EXISTS audit_checklist_modelos ON public.checklist_modelos;
CREATE TRIGGER audit_checklist_modelos AFTER INSERT OR UPDATE OR DELETE ON public.checklist_modelos FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_checklist_aplicacoes ON public.checklist_aplicacoes;
CREATE TRIGGER audit_checklist_aplicacoes AFTER INSERT OR UPDATE OR DELETE ON public.checklist_aplicacoes FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_checklist_planos_acao ON public.checklist_planos_acao;
CREATE TRIGGER audit_checklist_planos_acao AFTER INSERT OR UPDATE OR DELETE ON public.checklist_planos_acao FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
