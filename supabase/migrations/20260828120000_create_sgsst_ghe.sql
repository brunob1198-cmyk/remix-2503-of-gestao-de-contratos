-- GHE — Grupo Homogêneo de Exposição
--
-- POR QUE UMA TABELA PRÓPRIA, E NÃO UM CAMPO TEXTO NO PCMSO
--
-- O GHE é a unidade de agrupamento que a NR-01 usa quando trata de grupos
-- similarmente expostos (1.5.4.4.4): em vez de levantar risco e exame para cada
-- função isoladamente, agrupa-se quem tem a mesma exposição. O mesmo grupo
-- aparece no PGR (onde o risco é inventariado) e no PCMSO (onde o exame é
-- planejado). Se o GHE existisse só dentro do PCMSO, os dois documentos
-- passariam a ter listas independentes de quem está no grupo — e divergir sobre
-- isso é justamente o erro que o agrupamento existe para evitar.
--
-- Por isso o GHE é entidade da EMPRESA, referenciada pelos dois programas.
--
-- O CAMPO FUNÇÃO NÃO SAI DE LUGAR NENHUM
--
-- `sgsst_pcmso_exames.funcao_id` e `sgsst_pgr_inventario_funcoes` continuam
-- existindo e continuam válidos. O `ghe_id` é ALTERNATIVA, não substituição: há
-- exame que é do grupo todo (audiometria de quem trabalha no setor ruidoso) e
-- exame que é de uma função específica dentro do grupo. Forçar tudo para grupo
-- perderia o segundo caso; forçar tudo para função é o que se quer resolver.
--
-- QUANTIDADE DE TRABALHADORES
--
-- `quantidade_trabalhadores` é declarada, não contada. O sistema sabe contar
-- colaboradores ativos por função, mas o número que vai no documento é o que o
-- responsável técnico assume — inclusive quando difere do cadastro, porque o
-- levantamento de campo e o cadastro nem sempre estão sincronizados no dia da
-- emissão. Guardar a declaração permite mostrar as duas e apontar a diferença;
-- derivar silenciosamente esconderia que houve divergência.

-- 1. GHE
CREATE TABLE IF NOT EXISTS public.sgsst_ghe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  -- Código de referência do grupo no documento: "GHE-01". Texto e não inteiro
  -- porque os modelos de mercado usam formatos próprios (GHE-01, ADM-01, G1).
  codigo text NOT NULL,
  nome text NOT NULL,
  -- Setor e área de influência: as duas colunas do cabeçalho de GHE dos modelos.
  -- "Setor" é a estrutura organizacional (ADMINISTRATIVO, OPERACIONAL); "área de
  -- influência" é o espaço físico onde a exposição acontece (RECEPÇÃO, OFICINA).
  -- São coisas diferentes e frequentemente não coincidem.
  setor text,
  area_influencia text,
  -- Como aparece no documento: "44 horas semanais". Texto porque a jornada real
  -- inclui turno, escala 12x36 e revezamento, que não caberiam num número.
  carga_horaria text,
  quantidade_trabalhadores integer CHECK (quantidade_trabalhadores IS NULL OR quantidade_trabalhadores >= 0),
  descricao text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_ghe IS
  'Grupo Homogêneo de Exposição (NR-01 1.5.4.4.4). Entidade da empresa, compartilhada por PGR e PCMSO para que os dois programas não divirjam sobre quem está no grupo.';
COMMENT ON COLUMN public.sgsst_ghe.quantidade_trabalhadores IS
  'Quantidade DECLARADA pelo responsável técnico. Não é a contagem de colaboradores ativos: as duas podem divergir e o documento precisa mostrar a declarada.';

CREATE INDEX IF NOT EXISTS idx_sgsst_ghe_empresa ON public.sgsst_ghe(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ghe_status ON public.sgsst_ghe(empresa_id, status);

-- Código único por empresa: dois GHE com o mesmo código no mesmo documento
-- tornam impossível saber a qual deles a linha de exame se refere. O modelo que
-- serviu de referência tinha três "GHE-03" e é exatamente esse o problema.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_ghe_codigo
  ON public.sgsst_ghe(empresa_id, upper(codigo));

ALTER TABLE public.sgsst_ghe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_ghe" ON public.sgsst_ghe;
CREATE POLICY "Users view own empresa sgsst_ghe" ON public.sgsst_ghe
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_ghe" ON public.sgsst_ghe;
CREATE POLICY "Users insert own empresa sgsst_ghe" ON public.sgsst_ghe
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_ghe" ON public.sgsst_ghe;
CREATE POLICY "Users update own empresa sgsst_ghe" ON public.sgsst_ghe
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_ghe" ON public.sgsst_ghe;
CREATE POLICY "Users delete own empresa sgsst_ghe" ON public.sgsst_ghe
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_ghe ON public.sgsst_ghe;
CREATE TRIGGER audit_sgsst_ghe
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_ghe
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 2. FUNÇÕES DO GHE
--
-- N:N e não um `ghe_id` na função. Uma mesma função pode estar em GHEs
-- diferentes quando exerce a atividade em locais de exposição diferentes — o
-- eletricista da subestação e o eletricista da manutenção predial têm a mesma
-- função e exposições distintas. Um campo único na função forçaria criar funções
-- duplicadas para representar isso.
CREATE TABLE IF NOT EXISTS public.sgsst_ghe_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ghe_id uuid NOT NULL REFERENCES public.sgsst_ghe(id) ON DELETE CASCADE,
  -- RESTRICT e não SET NULL: sem função, a linha não significa nada. Excluir
  -- função que está em GHE tem de ser bloqueado para que o vínculo seja desfeito
  -- de propósito, e não como efeito colateral.
  funcao_id uuid NOT NULL REFERENCES public.sgsst_funcoes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sgsst_ghe_funcoes IS
  'Funções que compõem cada GHE. N:N porque a mesma função pode integrar GHEs distintos quando a exposição depende do local de trabalho.';

CREATE INDEX IF NOT EXISTS idx_sgsst_ghe_func_empresa ON public.sgsst_ghe_funcoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ghe_func_ghe ON public.sgsst_ghe_funcoes(ghe_id);
CREATE INDEX IF NOT EXISTS idx_sgsst_ghe_func_funcao ON public.sgsst_ghe_funcoes(funcao_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sgsst_ghe_funcao
  ON public.sgsst_ghe_funcoes(ghe_id, funcao_id);

ALTER TABLE public.sgsst_ghe_funcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes;
CREATE POLICY "Users view own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users insert own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes;
CREATE POLICY "Users insert own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users update own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes;
CREATE POLICY "Users update own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Users delete own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes;
CREATE POLICY "Users delete own empresa sgsst_ghe_funcoes" ON public.sgsst_ghe_funcoes
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS audit_sgsst_ghe_funcoes ON public.sgsst_ghe_funcoes;
CREATE TRIGGER audit_sgsst_ghe_funcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.sgsst_ghe_funcoes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- 3. LIGAÇÃO COM OS PROGRAMAS
--
-- Nas duas tabelas o `ghe_id` é NULLABLE e conviverá indefinidamente com o
-- vínculo por função. Nada do que já está lançado muda de comportamento.

-- Exame previsto do PCMSO: passa a poder ser do grupo.
ALTER TABLE public.sgsst_pcmso_exames
  ADD COLUMN IF NOT EXISTS ghe_id uuid REFERENCES public.sgsst_ghe(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sgsst_pcmso_exames.ghe_id IS
  'GHE ao qual o exame se aplica. Alternativo a funcao_id, nunca substituto: exame de grupo e exame de função específica coexistem no mesmo PCMSO.';

CREATE INDEX IF NOT EXISTS idx_sgsst_pcmso_ex_ghe ON public.sgsst_pcmso_exames(ghe_id);

-- Item do inventário do PGR: passa a poder ser levantado para o grupo.
ALTER TABLE public.sgsst_pgr_inventario
  ADD COLUMN IF NOT EXISTS ghe_id uuid REFERENCES public.sgsst_ghe(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sgsst_pgr_inventario.ghe_id IS
  'GHE exposto ao risco. Alternativo ao vínculo por função em sgsst_pgr_inventario_funcoes; os dois convivem.';

CREATE INDEX IF NOT EXISTS idx_sgsst_pgr_inv_ghe ON public.sgsst_pgr_inventario(ghe_id);
