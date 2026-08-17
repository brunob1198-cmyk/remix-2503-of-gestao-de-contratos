-- ============================================================================
-- MIGRATION: EVOLUÇÃO DO MÓDULO CHECKLISTS (PROMPT 020)
-- Data: 2026-08-17
-- ============================================================================

-- 1. ADICIONAR CAMPOS DE GEOLOCALIZAÇÃO E RAIO EM checklist_modelos
ALTER TABLE public.checklist_modelos 
ADD COLUMN IF NOT EXISTS exigir_geolocalizacao TEXT DEFAULT 'nao', -- 'nao', 'iniciar', 'finalizar', 'ambos'
ADD COLUMN IF NOT EXISTS latitude_alvo NUMERIC,
ADD COLUMN IF NOT EXISTS longitude_alvo NUMERIC,
ADD COLUMN IF NOT EXISTS raio_permitido_metros INT,
ADD COLUMN IF NOT EXISTS bloquear_fora_raio BOOLEAN DEFAULT false;

-- 2. TABELA: checklist_qrcodes
CREATE TABLE IF NOT EXISTS public.checklist_qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  checklist_modelo_id UUID NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
  vinculado_tipo TEXT NOT NULL DEFAULT 'outro', -- 'projeto', 'area', 'equipamento', 'veiculo', 'maquina', 'ferramenta', 'outro'
  vinculado_id TEXT,
  vinculado_nome TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA: checklist_geolocalizacoes
CREATE TABLE IF NOT EXISTS public.checklist_geolocalizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aplicacao_id UUID NOT NULL REFERENCES public.checklist_aplicacoes(id) ON DELETE CASCADE,
  momento TEXT NOT NULL, -- 'inicio', 'conclusao'
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  precisao NUMERIC,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA: checklist_agendamentos
CREATE TABLE IF NOT EXISTS public.checklist_agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  checklist_modelo_id UUID NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  area_id UUID,
  data_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
  data_final DATE,
  horario TIME DEFAULT '08:00',
  periodicidade TEXT NOT NULL DEFAULT 'SEMANAL', -- 'UNICA', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'
  prazo_dias INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'PAUSADO', 'ENCERRADO'
  exigir_geolocalizacao BOOLEAN DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA: checklist_agendamento_execucoes
CREATE TABLE IF NOT EXISTS public.checklist_agendamento_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES public.checklist_agendamentos(id) ON DELETE CASCADE,
  aplicacao_id UUID REFERENCES public.checklist_aplicacoes(id) ON DELETE SET NULL,
  competencia TEXT NOT NULL, -- e.g. '2026-W34', '2026-08-17'
  data_prevista DATE NOT NULL,
  prazo DATE NOT NULL,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA', 'CANCELADA'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELA: checklist_notificacoes (Se não existir notificacoes genérica)
CREATE TABLE IF NOT EXISTS public.checklist_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evento TEXT NOT NULL, -- 'ATRIBUIDO', 'VENCIMENTO_PROXIMO', 'ATRASADO', 'PLANO_VENCIMENTO', 'PLANO_ATRASADO', 'CONCLUIDO', 'NOVA_APLICACAO_AGENDADA'
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL, -- 'checklist_aplicacao', 'checklist_plano_acao', 'checklist_agendamento'
  entidade_id TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HABILITAR RLS EM TODAS AS NOVAS TABELAS
ALTER TABLE public.checklist_qrcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_geolocalizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_agendamento_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_notificacoes ENABLE ROW LEVEL SECURITY;

-- POLITICAS DE RLS
DROP POLICY IF EXISTS "checklist_qrcodes_empresa_policy" ON public.checklist_qrcodes;
CREATE POLICY "checklist_qrcodes_empresa_policy" ON public.checklist_qrcodes
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "checklist_geolocalizacoes_empresa_policy" ON public.checklist_geolocalizacoes;
CREATE POLICY "checklist_geolocalizacoes_empresa_policy" ON public.checklist_geolocalizacoes
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "checklist_agendamentos_empresa_policy" ON public.checklist_agendamentos;
CREATE POLICY "checklist_agendamentos_empresa_policy" ON public.checklist_agendamentos
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "checklist_agendamento_execucoes_empresa_policy" ON public.checklist_agendamento_execucoes;
CREATE POLICY "checklist_agendamento_execucoes_empresa_policy" ON public.checklist_agendamento_execucoes
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "checklist_notificacoes_user_policy" ON public.checklist_notificacoes;
CREATE POLICY "checklist_notificacoes_user_policy" ON public.checklist_notificacoes
  FOR ALL USING (
    user_id = auth.uid() OR empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

-- RPC PUBLICA SEGURA PARA VALIDAR TOKEN DO QR CODE
CREATE OR REPLACE FUNCTION public.get_public_checklist_qr_info(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qr RECORD;
  v_modelo RECORD;
BEGIN
  SELECT * INTO v_qr FROM public.checklist_qrcodes WHERE token = p_token AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'QR Code inválido ou desativado.');
  END IF;

  SELECT id, codigo, nome, categoria, descricao, exigir_geolocalizacao INTO v_modelo 
  FROM public.checklist_modelos WHERE id = v_qr.checklist_modelo_id;

  RETURN jsonb_build_object(
    'valid', true,
    'token', v_qr.token,
    'modelo_id', v_modelo.id,
    'modelo_nome', v_modelo.nome,
    'modelo_categoria', v_modelo.categoria,
    'exigir_geolocalizacao', COALESCE(v_modelo.exigir_geolocalizacao, 'nao'),
    'vinculado_tipo', v_qr.vinculado_tipo,
    'vinculado_id', v_qr.vinculado_id,
    'vinculado_nome', v_qr.vinculado_nome
  );
END;
$$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_chk_qrcodes_token ON public.checklist_qrcodes(token);
CREATE INDEX IF NOT EXISTS idx_chk_agendamentos_empresa ON public.checklist_agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chk_agendamento_exec_status ON public.checklist_agendamento_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_chk_notificacoes_user ON public.checklist_notificacoes(user_id, lida);
