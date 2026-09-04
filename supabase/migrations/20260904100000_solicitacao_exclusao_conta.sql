-- ============================================================================
-- Solicitação de exclusão de conta (Meu Perfil > Zona de Perigo)
-- ============================================================================
--
-- A política de privacidade (public/politica-de-privacidade.html, seção 12)
-- promete: "No aplicativo: acesse Meu Perfil e utilize a opção de solicitação
-- de exclusão de conta" e que "a conta ... é removida em até 30 dias". Por
-- isso este fluxo grava um PEDIDO — não apaga o usuário na hora. O cliente
-- Supabase autenticado não tem (e não deve ter) acesso a
-- auth.admin.deleteUser(); quem processa o pedido dentro do prazo é o
-- administrador da empresa, pela tela Gerenciar Usuários.
-- ============================================================================

CREATE TABLE public.solicitacoes_exclusao_conta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ,
  concluida_por UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.solicitacoes_exclusao_conta IS
  'Pedidos de exclusão de conta feitos pelo próprio usuário em Meu Perfil. Processados manualmente pelo admin da empresa em Gerenciar Usuários, dentro do prazo de 30 dias da política de privacidade.';

ALTER TABLE public.solicitacoes_exclusao_conta ENABLE ROW LEVEL SECURITY;

-- O usuário registra o próprio pedido.
CREATE POLICY "Usuario registra a propria solicitacao" ON public.solicitacoes_exclusao_conta
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- O usuário vê o próprio pedido; o admin vê os pedidos da sua própria empresa.
CREATE POLICY "Usuario ou admin da empresa veem a solicitacao" ON public.solicitacoes_exclusao_conta
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_empresa_id(user_id) = public.get_user_empresa_id(auth.uid())
    )
  );

-- Só o admin da mesma empresa do solicitante pode marcar como concluída.
CREATE POLICY "Admin conclui solicitacao da propria empresa" ON public.solicitacoes_exclusao_conta
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.get_user_empresa_id(user_id) = public.get_user_empresa_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX idx_solicitacoes_exclusao_conta_status ON public.solicitacoes_exclusao_conta(status);
