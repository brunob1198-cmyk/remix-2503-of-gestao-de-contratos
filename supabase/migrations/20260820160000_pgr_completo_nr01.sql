-- Migration: PGR completo pela NR-01 (Fase 3 do plano de Seguranca)
--
-- Tres frentes:
--
--   1. INVENTARIO DE RISCOS (NR-01 1.5.7.3.2). Das 9 alineas, 5 estavam
--      atendidas, 2 parcialmente e 2 ausentes:
--        - AUSENTE: caracterizacao da exposicao (habitual/ocasional e duracao).
--        - AUSENTE: dados de monitoramento (intensidade medida, limite aplicado,
--          tecnica de avaliacao).
--        - PARCIAL: `trabalhadores_expostos` guardava um NUMERO, mas a norma pede
--          QUAIS GRUPOS estao expostos. Numero nao identifica ninguem.
--        - PARCIAL: so havia `area_id`, sem descricao do ambiente.
--
--   2. PLANO DE ACAO (NR-01 1.5.5.2). Havia medida, tipo, responsavel e prazo.
--      Faltavam as duas coisas que a norma pede junto: "formas de
--      acompanhamento" e "afericao dos resultados".
--
--   3. HISTORICO. O PGR era o UNICO dos dez modulos SGSST sem tabela de
--      historico — justamente o documento que a norma manda manter por 20 anos
--      COM historico das atualizacoes (1.5.7.3.3).

-- =====================================================================
-- 1. Inventario: as alineas que faltavam
-- =====================================================================
ALTER TABLE public.sgsst_pgr_inventario
  -- Alinea da caracterizacao da exposicao.
  ADD COLUMN IF NOT EXISTS tipo_exposicao text
    CHECK (tipo_exposicao IS NULL OR tipo_exposicao IN ('HABITUAL', 'OCASIONAL', 'EVENTUAL')),
  ADD COLUMN IF NOT EXISTS tempo_exposicao text,

  -- Descricao do ambiente. `area_id` diz onde no cadastro; isto diz como e o
  -- lugar (ventilacao, confinamento, iluminacao), que e o que o fiscal le.
  ADD COLUMN IF NOT EXISTS descricao_local text,

  -- Grupos expostos em texto, para o caso de grupo que nao corresponde a uma
  -- funcao cadastrada (visitantes, terceiros de empreiteira). A identificacao
  -- estruturada vai na tabela de ligacao adiante.
  ADD COLUMN IF NOT EXISTS grupos_expostos text,

  -- Alinea dos dados de monitoramento. Sem isto o inventario afirma que o risco
  -- e "moderado" sem nenhuma medicao por tras.
  ADD COLUMN IF NOT EXISTS intensidade_medida numeric,
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS limite_tolerancia_aplicado numeric,
  ADD COLUMN IF NOT EXISTS tecnica_avaliacao text
    CHECK (tecnica_avaliacao IS NULL OR tecnica_avaliacao IN ('QUALITATIVA', 'QUANTITATIVA')),
  ADD COLUMN IF NOT EXISTS data_medicao date,
  -- O resultado e declarado, nao calculado: para oxigenio em espaco confinado a
  -- A NR-33 33.5.15.2 admite entrada com O2 ENTRE 19,5% e 23%, entao tanto
  -- falta quanto excesso reprovam. Um `medida > limite` generico daria
  -- "conforme" no caso que mata.
  ADD COLUMN IF NOT EXISTS resultado_avaliacao text
    CHECK (resultado_avaliacao IS NULL OR resultado_avaliacao IN
      ('ABAIXO_LIMITE', 'ACIMA_LIMITE', 'NAO_APLICAVEL')),
  ADD COLUMN IF NOT EXISTS metodologia_medicao text;

COMMENT ON COLUMN public.sgsst_pgr_inventario.tipo_exposicao IS
  'HABITUAL/OCASIONAL/EVENTUAL. Caracterizacao da exposicao exigida pela NR-01 1.5.7.3.2. Herdado de sgsst_funcao_riscos quando o risco vem de uma funcao.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.trabalhadores_expostos IS
  'QUANTIDADE de expostos. A norma pede tambem QUAIS grupos — ver grupos_expostos e a tabela sgsst_pgr_inventario_funcoes.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.resultado_avaliacao IS
  'Declarado por quem avalia, nao calculado. Ha agente cujo limite e piso e nao teto (oxigenio, NR-33), onde comparar por "maior que" inverteria a conclusao.';
COMMENT ON COLUMN public.sgsst_pgr_inventario.limite_tolerancia_aplicado IS
  'Limite usado NESTA avaliacao. Copiado do catalogo no momento do lancamento, nao lido por join: se o catalogo mudar depois, o inventario nao pode mudar retroativamente.';

-- =====================================================================
-- 2. Grupos expostos: quais funcoes, nao quantas pessoas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_inventario_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL REFERENCES public.sgsst_pgr_inventario(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_pgr_inventario_funcoes IS
  'Grupos de trabalhadores expostos ao item do inventario, identificados por funcao. NR-01 1.5.7.3.2 pede QUAIS grupos, e a fase 2 ja sabe quais funcoes se expoem a cada risco — a tela sugere a partir dali.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_pgr_inv_funcoes
  ON public.sgsst_pgr_inventario_funcoes(inventario_id, funcao_id);

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_empresa
  ON public.sgsst_pgr_inventario_funcoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_inv
  ON public.sgsst_pgr_inventario_funcoes(inventario_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_invf_funcao
  ON public.sgsst_pgr_inventario_funcoes(funcao_id);

ALTER TABLE public.sgsst_pgr_inventario_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users view own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users insert own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users update own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes;
CREATE POLICY "Users delete own empresa sgsst_pgr_inventario_funcoes" ON public.sgsst_pgr_inventario_funcoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pgr_inventario_funcoes ON public.sgsst_pgr_inventario_funcoes;
CREATE TRIGGER audit_sgsst_pgr_inventario_funcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pgr_inventario_funcoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_pgr_inv_funcoes_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_pgr_inventario
    WHERE id = NEW.inventario_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: O item de inventário informado não pertence à mesma empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_funcoes
    WHERE id = NEW.funcao_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A função informada não pertence à mesma empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_pgr_inv_funcoes_tenant_check ON public.sgsst_pgr_inventario_funcoes;
CREATE TRIGGER trg_sgsst_pgr_inv_funcoes_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pgr_inventario_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_pgr_inv_funcoes_tenant_integrity();

-- =====================================================================
-- 3. Plano de acao: acompanhamento e afericao (NR-01 1.5.5.2)
-- =====================================================================
ALTER TABLE public.sgsst_pgr_medidas_controle
  ADD COLUMN IF NOT EXISTS forma_acompanhamento text,
  ADD COLUMN IF NOT EXISTS verificador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_verificacao date,
  -- Tres valores, nao ACEITA/REJEITADA como nas nao conformidades: medida de
  -- controle costuma funcionar em parte, e forcar binario esconderia justamente
  -- o caso que precisa de reforco.
  ADD COLUMN IF NOT EXISTS resultado_verificacao text
    CHECK (resultado_verificacao IS NULL OR resultado_verificacao IN
      ('EFICAZ', 'PARCIALMENTE_EFICAZ', 'INEFICAZ')),
  ADD COLUMN IF NOT EXISTS observacao_verificacao text;

COMMENT ON COLUMN public.sgsst_pgr_medidas_controle.forma_acompanhamento IS
  'Como o cumprimento da medida sera acompanhado. NR-01 1.5.5.2 exige no plano de acao.';
COMMENT ON COLUMN public.sgsst_pgr_medidas_controle.resultado_verificacao IS
  'Afericao dos resultados exigida pela NR-01 1.5.5.2: a medida implantada de fato reduziu o risco? PARCIALMENTE_EFICAZ existe porque medida de controle costuma funcionar em parte.';

-- =====================================================================
-- 4. Revisao periodica (NR-01 1.5.4.4.5)
-- =====================================================================
ALTER TABLE public.sgsst_pgr
  -- 24 meses e a regra geral. A norma admite 3 anos quando ha sistema de gestao
  -- de SST certificado, entao o prazo e dado, nao constante no codigo.
  ADD COLUMN IF NOT EXISTS periodicidade_revisao_meses integer NOT NULL DEFAULT 24
    CHECK (periodicidade_revisao_meses > 0),
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  -- Congelamento da identificacao da organizacao na emissao: ler de `empresas`
  -- na hora de imprimir faria PGRs antigos passarem a mostrar o nome novo.
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  -- Quem responde tecnicamente pelo documento, com registro profissional.
  ADD COLUMN IF NOT EXISTS responsavel_tecnico text,
  ADD COLUMN IF NOT EXISTS registro_responsavel text,
  ADD COLUMN IF NOT EXISTS metodologia text;

COMMENT ON COLUMN public.sgsst_pgr.periodicidade_revisao_meses IS
  'NR-01 1.5.4.4.5: revisao a cada 2 anos, ou 3 anos com sistema de gestao de SST certificado. Guardado como dado para o alerta respeitar o caso de 3 anos.';
COMMENT ON COLUMN public.sgsst_pgr.data_revisao IS
  'Data da ULTIMA revisao realizada. O vencimento e calculado somando periodicidade_revisao_meses a esta data, ou a data_inicio quando nunca houve revisao.';

-- Retro-preenche a identificacao da organizacao nos PGRs ja criados, para o PDF
-- deles nao sair sem nome nem CNPJ.
UPDATE public.sgsst_pgr p
SET empresa_nome = e.nome,
    empresa_cnpj = e.cnpj
FROM public.empresas e
WHERE e.id = p.empresa_id
  AND p.empresa_nome IS NULL;

-- =====================================================================
-- 5. Historico do PGR (NR-01 1.5.7.3.3 — 20 anos com historico)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_pgr_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pgr_id uuid NOT NULL REFERENCES public.sgsst_pgr(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  operacao text NOT NULL,
  versao integer,
  status_anterior text,
  status_novo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_pgr_historico IS
  'Historico de alteracoes do PGR. Era o unico dos dez modulos SGSST sem historico, justamente no documento que a NR-01 manda manter por 20 anos com historico das atualizacoes.';

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_hist_empresa ON public.sgsst_pgr_historico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_hist_pgr ON public.sgsst_pgr_historico(pgr_id, created_at DESC);

ALTER TABLE public.sgsst_pgr_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico;
CREATE POLICY "Users view own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico;
CREATE POLICY "Users insert own empresa sgsst_pgr_historico" ON public.sgsst_pgr_historico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

-- Sem policy de UPDATE nem de DELETE, de proposito: historico que pode ser
-- editado ou apagado nao serve como historico. As demais tabelas ganham as
-- quatro policies; esta fica com duas.

-- =====================================================================
-- 6. Trigger que registra o historico
-- =====================================================================
-- Em trigger, e nao na aplicacao: alteracao feita por script, pelo painel do
-- Supabase ou por outra tela do sistema tambem precisa aparecer no historico.
-- Registro pela aplicacao so cobre o caminho que a aplicacao conhece.
CREATE OR REPLACE FUNCTION public.fn_sgsst_pgr_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operacao text;
  v_observacao text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sgsst_pgr_historico
      (empresa_id, pgr_id, usuario_id, operacao, versao, status_novo, observacao)
    VALUES
      (NEW.empresa_id, NEW.id, NEW.created_by, 'CRIACAO', NEW.versao, NEW.status,
       'PGR criado');
    RETURN NEW;
  END IF;

  -- UPDATE: so registra quando algo relevante mudou. Gravar linha a cada
  -- `updated_at` tocado encheria o historico de ruido e esconderia a mudanca
  -- que importa.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_operacao := 'MUDANCA_STATUS';
    v_observacao := format('Status alterado de %s para %s', OLD.status, NEW.status);
  ELSIF NEW.versao IS DISTINCT FROM OLD.versao THEN
    v_operacao := 'NOVA_VERSAO';
    v_observacao := format('Versão %s emitida', NEW.versao);
  ELSIF NEW.data_revisao IS DISTINCT FROM OLD.data_revisao THEN
    v_operacao := 'REVISAO';
    v_observacao := format('Data de revisão registrada: %s', NEW.data_revisao);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.sgsst_pgr_historico
    (empresa_id, pgr_id, usuario_id, operacao, versao, status_anterior, status_novo, observacao)
  VALUES
    (NEW.empresa_id, NEW.id, NEW.updated_by, v_operacao, NEW.versao, OLD.status, NEW.status,
     v_observacao);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_pgr_historico ON public.sgsst_pgr;
CREATE TRIGGER trg_sgsst_pgr_historico
  AFTER INSERT OR UPDATE ON public.sgsst_pgr
  FOR EACH ROW EXECUTE FUNCTION public.fn_sgsst_pgr_historico();

-- =====================================================================
-- 7. Semeia o historico dos PGRs que ja existiam
-- =====================================================================
-- Sem isto, um PGR criado antes desta migration apareceria sem nenhum registro,
-- como se nunca tivesse sido criado. Idempotente pelo NOT EXISTS.
INSERT INTO public.sgsst_pgr_historico
  (empresa_id, pgr_id, usuario_id, operacao, versao, status_novo, observacao, created_at)
SELECT p.empresa_id, p.id, p.created_by, 'CRIACAO', p.versao, p.status,
       'Registro retroativo: PGR criado antes do histórico existir', p.created_at
FROM public.sgsst_pgr p
WHERE NOT EXISTS (
  SELECT 1 FROM public.sgsst_pgr_historico h WHERE h.pgr_id = p.id
);
