-- Acompanhamento e aferição nas medidas de controle da APR
--
-- O DEFEITO QUE ISTO CORRIGE
--
-- A tela da APR reaproveita o formulário de medidas do PGR
-- (`PgrMedidasFormDialog`), que ganhou os campos de acompanhamento e aferição
-- quando o PGR foi ajustado à NR-01 1.5.5.2. A tabela do PGR recebeu as colunas
-- naquela migration; a da APR não. Resultado: cadastrar medida na APR falhava com
--
--   Could not find the 'data_implementacao' column of 'sgsst_apr_medidas'
--
-- O formulário é o mesmo, então as colunas têm de ser as mesmas. A alternativa
-- seria o formulário omitir campos quando salva na APR, e isso deixaria a APR sem
-- registrar se a medida foi implantada nem se funcionou — a mesma pergunta que a
-- NR-01 faz do plano de ação do PGR vale para a medida de controle da APR.
--
-- Os nomes, tipos e o CHECK são copiados de `sgsst_pgr_medidas_controle` de
-- propósito: campo com o mesmo significado e nome diferente nas duas tabelas é
-- como uma consulta que soma as duas passa a mentir.

ALTER TABLE public.sgsst_apr_medidas
  -- Quando a medida passou a existir de fato. Distinta do `prazo`, que é promessa:
  -- é a diferença entre as duas que mede atraso.
  ADD COLUMN IF NOT EXISTS data_implementacao date,

  -- NR-01 1.5.5.2 pede as duas coisas junto com a medida: como o cumprimento será
  -- acompanhado, e se a medida implantada de fato reduziu o risco.
  ADD COLUMN IF NOT EXISTS forma_acompanhamento text,
  ADD COLUMN IF NOT EXISTS verificador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_verificacao date,

  -- Três valores, e não ACEITA/REJEITADA como nas não conformidades: medida de
  -- controle costuma funcionar em parte, e forçar binário esconderia justamente o
  -- caso que precisa de reforço.
  ADD COLUMN IF NOT EXISTS resultado_verificacao text
    CHECK (resultado_verificacao IS NULL OR resultado_verificacao IN
      ('EFICAZ', 'PARCIALMENTE_EFICAZ', 'INEFICAZ')),
  ADD COLUMN IF NOT EXISTS observacao_verificacao text;

COMMENT ON COLUMN public.sgsst_apr_medidas.data_implementacao IS
  'Quando a medida passou a existir de fato. Distinta do prazo, que é promessa: a diferença entre as duas mede atraso.';
COMMENT ON COLUMN public.sgsst_apr_medidas.forma_acompanhamento IS
  'Como o cumprimento da medida será acompanhado. Mesmo campo e mesmo significado que em sgsst_pgr_medidas_controle.';
COMMENT ON COLUMN public.sgsst_apr_medidas.resultado_verificacao IS
  'Aferição do resultado: a medida implantada de fato reduziu o risco? PARCIALMENTE_EFICAZ existe porque medida de controle costuma funcionar em parte.';

-- Consulta o plano de ação por prazo, que é o recorte que a tela usa.
CREATE INDEX IF NOT EXISTS idx_sgsst_apr_medidas_prazo
  ON public.sgsst_apr_medidas(empresa_id, prazo)
  WHERE prazo IS NOT NULL;
