## Objetivo
Restaurar as três modalidades de geração de medição no diálogo "Gerar Medição do Período", como aparecia no modelo antigo (imagem 242):

- **Separada por Site** — uma linha por item de cada site (comportamento atual).
- **Agrupada por Projeto** — consolida tudo do projeto em uma única medição agrupada.
- **Mista (Consolidado)** — mantém os sites separados dentro da mesma medição, mas consolida itens iguais de diferentes sites em uma única linha somando as quantidades/valores.

Atualmente o diálogo (`GerarMedicaoDialog.tsx`) só oferece "Separada" e "Agrupada", tendo perdido a opção "Mista" no redesenho de 3 etapas.

## Alterações

### 1. `src/components/medicoes/acompanhamento/GerarMedicaoDialog.tsx`
- Adicionar terceira opção no RadioGroup do "Tipo de Medição": `mista` com o rótulo **"Mista (Consolidado)"** e a descrição de apoio **"Consolida itens iguais de diferentes sites em uma única linha."**.
- Ajustar o tipo do estado `tipoMedicao` para `"separada" | "agrupada" | "mista"` (o schema em `src/lib/schemas/medicao.ts` já aceita os três valores).
- Na etapa de "Ver Itens", adaptar o agrupamento dos itens produzidos:
  - `separada`: uma linha por (site, item_lpu) — atual.
  - `agrupada`: uma linha por item_lpu do projeto todo (soma quantidades entre sites), sem `site_id`.
  - `mista`: mantém `site_id` de cada linha, mas dentro do mesmo site consolida itens duplicados (mesmo `item_lpu_id`) somando quantidades. Marca a observação com `tipo:mista` para que o agrupamento em `AcompanhamentoMedicoes.tsx` reconheça (regex já existe: `obs.includes("tipo:mista")`).

### 2. `src/pages/medicoes/AcompanhamentoMedicoes.tsx`
- Nenhuma alteração de lógica: a chave de agrupamento em `medicoesAgrupadas` já trata `tipo:agrupada` e `tipo:mista` como consolidados por projeto.

## Detalhes técnicos
- O schema `gerarMedicaoSchema` já suporta `z.enum(["separada", "agrupada", "mista"])`.
- Os campos persistidos em `lancamentos_medicao.observacao` seguem o padrão `tipo:<modalidade>` para permitir reagrupamento posterior.
- Nenhuma migração de banco necessária.
