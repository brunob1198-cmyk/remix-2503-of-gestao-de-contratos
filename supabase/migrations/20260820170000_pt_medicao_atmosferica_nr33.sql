-- Migration: medicao atmosferica da PT de espaco confinado (Fase 4 do plano)
--
-- A PT ja cobria os tipos que a norma exige (espaco confinado, altura,
-- eletricidade) e os participantes ja tinham responsabilidade e confirmacao. O
-- que faltava era o registro que a NR-33 torna condicao de entrada: a avaliacao
-- atmosferica.
--
-- Sem esse registro, uma PT de espaco confinado podia ser aprovada e executada
-- sem que ninguem tivesse medido oxigenio, inflamaveis ou contaminantes. Isso
-- nao e lacuna de cadastro, e o item que a norma coloca antes da entrada.
--
-- VALORES DA NORMA, conferidos no texto oficial:
--   - 33.5.15.2: entrada aceitavel com oxigenio ENTRE 19,5% e 23% em volume.
--   - Glossario: "deficiencia de oxigenio" = menos de 20,9%; "enriquecimento"
--     = mais de 23%. Ou seja, a faixa de 19,5% a 20,9% ja e deficiencia, e so e
--     admitida quando a causa da variacao e conhecida e controlada — por isso a
--     coluna `causa_variacao_conhecida` existe.
--   - Anexo II (modelo de PET): inflamaveis abaixo de 10% do LIE.
--   - Contaminantes toxicos: a NR-33 NAO fixa limite proprio; remete a avaliacao
--     do PGR (NR-01) e aos limites da NR-15. Por isso o limite do contaminante e
--     informado por medicao, e nao constante aqui.

-- =====================================================================
-- 0. Correcao de um dado errado semeado na fase 1
-- =====================================================================
-- A fase 1 gravou "atmosfera entre 20,9% e 23%" como base legal do risco QUI-05.
-- Esta errado: 20,9% e o limiar de DEFICIENCIA, nao o de entrada. O criterio de
-- entrada da 33.5.15.2 e 19,5% a 23%.
--
-- O WHERE compara o texto antigo exato de proposito: se o usuario ja editou esse
-- campo, a edicao dele nao pode ser sobrescrita por esta correcao.
UPDATE public.sgsst_riscos_catalogo
SET base_legal = 'NR-33 33.5.15.2 — entrada com O₂ entre 19,5% e 23%; abaixo de 20,9% já é deficiência de oxigênio'
WHERE codigo = 'QUI-05'
  AND base_legal = 'NR-33 — atmosfera entre 20,9% e 23% de O₂; medição obrigatória antes da entrada';

-- =====================================================================
-- 1. Medicoes atmosfericas da PT
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.sgsst_pt_medicoes_atmosfera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pt_id uuid NOT NULL REFERENCES public.sgsst_pt(id) ON DELETE CASCADE,

  medido_em timestamptz NOT NULL DEFAULT now(),
  -- A NR-33 exige medicao ANTES da entrada, monitoramento continuo DURANTE e
  -- nova medicao APOS interrupcao. Sao momentos diferentes e a norma trata cada
  -- um: guardar tudo como "uma medicao" perderia essa distincao.
  momento text NOT NULL DEFAULT 'ANTES_ENTRADA'
    CHECK (momento IN ('ANTES_ENTRADA', 'DURANTE', 'APOS_INTERRUPCAO')),

  -- Oxigenio em % de volume. O CHECK e de sanidade fisica, nao de conformidade:
  -- a avaliacao contra a faixa da norma fica na aplicacao, para poder explicar
  -- ao usuario por que reprovou.
  oxigenio_percentual numeric
    CHECK (oxigenio_percentual IS NULL OR (oxigenio_percentual >= 0 AND oxigenio_percentual <= 100)),
  -- Declarado por quem mede: a faixa de 19,5% a 20,9% e deficiencia de oxigenio
  -- e so pode ser aceita se a causa da variacao for conhecida e controlada.
  causa_variacao_conhecida boolean NOT NULL DEFAULT false,

  -- Gases e vapores inflamaveis, em % do Limite Inferior de Inflamabilidade.
  inflamaveis_percentual_lie numeric
    CHECK (inflamaveis_percentual_lie IS NULL OR inflamaveis_percentual_lie >= 0),

  -- Contaminante toxico. O limite vem informado porque a NR-33 nao fixa valor
  -- proprio: remete a NR-15 e ao PGR, e o limite varia por substancia.
  contaminante_nome text,
  contaminante_valor numeric CHECK (contaminante_valor IS NULL OR contaminante_valor >= 0),
  contaminante_unidade text,
  contaminante_limite numeric CHECK (contaminante_limite IS NULL OR contaminante_limite >= 0),

  -- Equipamento: a norma exige detector adequado e calibrado. Medicao feita com
  -- detector fora de calibracao nao serve como avaliacao.
  equipamento text,
  numero_serie text,
  calibracao_validade date,

  medido_por_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  medido_por_nome text,
  observacoes text,

  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_pt_medicoes_atmosfera IS
  'Avaliacao atmosferica exigida pela NR-33 para entrada em espaco confinado. Sem registro aqui, a PT podia ser aprovada sem ninguem ter medido nada.';
COMMENT ON COLUMN public.sgsst_pt_medicoes_atmosfera.momento IS
  'ANTES_ENTRADA, DURANTE (monitoramento continuo) ou APOS_INTERRUPCAO. A NR-33 exige os tres em situacoes diferentes.';
COMMENT ON COLUMN public.sgsst_pt_medicoes_atmosfera.causa_variacao_conhecida IS
  'Oxigenio entre 19,5% e 20,9% e deficiencia; a norma so admite a entrada se a causa da variacao for conhecida e controlada. Este campo registra essa declaracao.';
COMMENT ON COLUMN public.sgsst_pt_medicoes_atmosfera.inflamaveis_percentual_lie IS
  'Percentual do Limite Inferior de Inflamabilidade. O modelo de PET do Anexo II da NR-33 exige abaixo de 10%.';
COMMENT ON COLUMN public.sgsst_pt_medicoes_atmosfera.contaminante_limite IS
  'Limite de tolerancia do contaminante. Informado por medicao porque a NR-33 nao fixa valor proprio — remete a NR-15 e ao PGR, e o limite varia por substancia.';
COMMENT ON COLUMN public.sgsst_pt_medicoes_atmosfera.medido_por_nome IS
  'Nome de quem mediu, em texto. Existe porque frequentemente quem opera o detector e terceiro sem cadastro de profile no sistema.';

CREATE INDEX IF NOT EXISTS idx_sgsst_pt_atm_empresa
  ON public.sgsst_pt_medicoes_atmosfera(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_pt_atm_pt
  ON public.sgsst_pt_medicoes_atmosfera(pt_id, medido_em DESC);

ALTER TABLE public.sgsst_pt_medicoes_atmosfera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera;
CREATE POLICY "Users view own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera;
CREATE POLICY "Users insert own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera;
CREATE POLICY "Users update own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera;
CREATE POLICY "Users delete own empresa sgsst_pt_medicoes_atmosfera" ON public.sgsst_pt_medicoes_atmosfera
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_pt_medicoes_atmosfera ON public.sgsst_pt_medicoes_atmosfera;
CREATE TRIGGER audit_sgsst_pt_medicoes_atmosfera
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_pt_medicoes_atmosfera
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE OR REPLACE FUNCTION public.check_sgsst_pt_atmosfera_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sgsst_pt
    WHERE id = NEW.pt_id AND empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Violação de Multitenancy: A permissão de trabalho informada não pertence à mesma empresa.';
  END IF;

  -- Medicao sem nenhum parametro nao e medicao. Barrar aqui evita linha vazia
  -- contando como "atmosfera avaliada" no painel de liberacao.
  IF NEW.oxigenio_percentual IS NULL
     AND NEW.inflamaveis_percentual_lie IS NULL
     AND NEW.contaminante_valor IS NULL THEN
    RAISE EXCEPTION 'Registre ao menos um parâmetro medido: oxigênio, inflamáveis ou contaminante.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_pt_atmosfera_tenant_check ON public.sgsst_pt_medicoes_atmosfera;
CREATE TRIGGER trg_sgsst_pt_atmosfera_tenant_check
  BEFORE INSERT OR UPDATE ON public.sgsst_pt_medicoes_atmosfera
  FOR EACH ROW EXECUTE FUNCTION public.check_sgsst_pt_atmosfera_tenant_integrity();

-- =====================================================================
-- 2. Papeis dos participantes da PT
-- =====================================================================
-- A NR-33 nomeia tres papeis: Trabalhador Autorizado, Vigia e Supervisor de
-- Entrada. O campo `responsabilidade` existia como texto livre sem CHECK.
--
-- Nao entra CHECK aqui de proposito: ha PTs ja cadastradas com valores livres, e
-- um CHECK retroativo faria a migration falhar ou obrigaria a reescrever dado do
-- usuario. A tela passa a oferecer os papeis da norma como opcao, e a validacao
-- de "PT de espaco confinado exige vigia" fica na aplicacao, onde pode explicar
-- o motivo em vez de so recusar.
COMMENT ON COLUMN public.sgsst_pt_participantes.responsabilidade IS
  'Papel na atividade. Para espaco confinado a NR-33 nomeia Trabalhador Autorizado, Vigia e Supervisor de Entrada — a PT de espaco confinado exige um Vigia designado.';

-- =====================================================================
-- 3. Campos de espaco confinado na PT
-- =====================================================================
ALTER TABLE public.sgsst_pt
  -- Ventilacao e bloqueio de energias sao pre-requisitos da entrada, e nao
  -- itens de checklist livre: o painel de liberacao precisa saber deles.
  ADD COLUMN IF NOT EXISTS ventilacao_adotada text,
  ADD COLUMN IF NOT EXISTS bloqueio_energias boolean,
  ADD COLUMN IF NOT EXISTS plano_resgate text,
  -- Validade da PT. A norma limita a permissao ao turno de trabalho; PT sem
  -- validade fica valendo indefinidamente, o que e o oposto do que ela e.
  ADD COLUMN IF NOT EXISTS validade_fim timestamptz;

COMMENT ON COLUMN public.sgsst_pt.validade_fim IS
  'Fim da validade da permissao. A PT vale para o turno/periodo autorizado; sem esse limite ela ficaria valendo indefinidamente.';
COMMENT ON COLUMN public.sgsst_pt.plano_resgate IS
  'Procedimento de resgate previsto. A NR-33 exige que haja plano antes da entrada, nao depois do acidente.';
