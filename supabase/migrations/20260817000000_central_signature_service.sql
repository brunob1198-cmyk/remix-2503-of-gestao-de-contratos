-- ============================================================================
-- MIGRATION: SERVIÇO CENTRAL DE ASSINATURA DIGITAL DO SAAS
-- Data: 2026-08-17
-- ============================================================================

-- 1. ENUM / CONSTANTS DE STATUS E MÉTODOS
-- Status: PENDENTE, EM_ASSINATURA, ASSINADO, RECUSADO, CANCELADO, EXPIRADO, INVALIDADO
-- Metodos: ASSINATURA_ELETRONICA_INTERNA, GOV_BR, ICP_BRASIL_FUTURO

-- 2. TABELA: signature_requests
CREATE TABLE IF NOT EXISTS public.signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  documento_id TEXT,
  modulo_origem TEXT NOT NULL, -- 'CHECKLISTS', 'APR', 'PT', 'INSPECOES', 'INCIDENTES', 'EPI', etc.
  entidade_tipo TEXT NOT NULL, -- 'checklist_aplicacao', 'apr', 'pt', etc.
  entidade_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  metodo TEXT NOT NULL DEFAULT 'ASSINATURA_ELETRONICA_INTERNA',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA: signature_signers
CREATE TABLE IF NOT EXISTS public.signature_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  signature_request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  cargo TEXT,
  empresa_nome TEXT,
  ordem INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'ASSINADO', 'RECUSADO'
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA: signature_events (Auditoria Imutável)
CREATE TABLE IF NOT EXISTS public.signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  signature_request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  evento TEXT NOT NULL, -- 'SOLICITACAO_CRIADA', 'DOCUMENTO_GERADO', 'ASSINATURA_INICIADA', 'ASSINATURA_CONCLUIDA', 'ASSINATURA_RECUSADA', 'ASSINATURA_CANCELADA', 'DOCUMENTO_BAIXADO', 'DOCUMENTO_INVALIDADO'
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA: signature_documents
CREATE TABLE IF NOT EXISTS public.signature_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  signature_request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  arquivo_original TEXT NOT NULL,
  arquivo_assinado TEXT,
  hash_original TEXT NOT NULL,
  hash_assinado TEXT,
  tamanho INT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;

-- POLITICAS DE RLS BASEADAS EM EMPRESA_ID
-- signature_requests
DROP POLICY IF EXISTS "signature_requests_empresa_policy" ON public.signature_requests;
CREATE POLICY "signature_requests_empresa_policy" ON public.signature_requests
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

-- signature_signers
DROP POLICY IF EXISTS "signature_signers_empresa_policy" ON public.signature_signers;
CREATE POLICY "signature_signers_empresa_policy" ON public.signature_signers
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

-- signature_events
DROP POLICY IF EXISTS "signature_events_empresa_policy" ON public.signature_events;
CREATE POLICY "signature_events_empresa_policy" ON public.signature_events
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

-- signature_documents
DROP POLICY IF EXISTS "signature_documents_empresa_policy" ON public.signature_documents;
CREATE POLICY "signature_documents_empresa_policy" ON public.signature_documents
  FOR ALL USING (
    empresa_id = public.get_user_empresa_id(auth.uid()) OR auth.role() = 'service_role'
  );

-- INDEXES PARA DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_signature_requests_empresa ON public.signature_requests(empresa_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_entidade ON public.signature_requests(modulo_origem, entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_signature_signers_request ON public.signature_signers(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_request ON public.signature_events(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_documents_request ON public.signature_documents(signature_request_id);

-- RPC PUBLICA SEGURA PARA VERIFICAÇÃO DE ASSINATURA (QR CODE PUBLICO)
-- Permite consultar unicamente metadados públicos de validação sem expor dados internos ou sigilosos.
CREATE OR REPLACE FUNCTION public.get_public_signature_verification(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_signer RECORD;
  v_doc RECORD;
  v_empresa_nome TEXT;
BEGIN
  SELECT * INTO v_req FROM public.signature_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Solicitação de assinatura não encontrada');
  END IF;

  SELECT nome INTO v_empresa_nome FROM public.empresas WHERE id = v_req.empresa_id;

  SELECT * INTO v_signer FROM public.signature_signers 
  WHERE signature_request_id = p_request_id AND status = 'ASSINADO' 
  ORDER BY signed_at DESC LIMIT 1;

  SELECT * INTO v_doc FROM public.signature_documents 
  WHERE signature_request_id = p_request_id 
  ORDER BY created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'valid', (v_req.status = 'ASSINADO'),
    'status', v_req.status,
    'id', v_req.id,
    'modulo_origem', v_req.modulo_origem,
    'metodo', v_req.metodo,
    'empresa_nome', COALESCE(v_empresa_nome, 'Empresa Cadastrada'),
    'created_at', v_req.created_at,
    'signed_at', v_signer.signed_at,
    'signer_nome', COALESCE(v_signer.nome, 'Signatário do Sistema'),
    'signer_cargo', v_signer.cargo,
    'hash_original', v_doc.hash_original,
    'hash_assinado', v_doc.hash_assinado,
    'arquivo_assinado_url', v_doc.arquivo_assinado
  );
END;
$$;
