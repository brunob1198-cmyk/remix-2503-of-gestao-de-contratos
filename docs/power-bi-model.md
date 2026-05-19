# Modelo de Dados Power BI - Análise de Obras

Este documento descreve como utilizar a view `view_bi_analise_obras` para modelagem no Power BI.

## Estrutura da View `view_bi_analise_obras`

A view foi projetada para atuar como uma **Tabela Fato** de desempenho mensal por projeto.

### Colunas de Identificação e Dimensão (Atributos)
| Coluna | Descrição | Uso Sugerido |
|:---|:---|:---|
| `projeto_id` | ID único do projeto (UUID) | Chave de ligação com DimProjeto |
| `mes` | Data truncada no primeiro dia do mês | Eixo cronológico / Ligação com Calendário |
| `mes_id` | Formato numérico YYYYMM (ex: 202601) | Ordenação e filtros de tempo |
| `projeto_codigo` | Código visível do projeto | Rótulo de Gráfico |
| `projeto_nome` | Nome completo do projeto | Rótulo de Gráfico |
| `area_nome` | Área de negócio/análise | Segmentação (Slicer) |
| `cliente` | Nome do cliente | Segmentação (Slicer) |
| `empresa_nome` | Nome da empresa executora | Segmentação (Slicer) |

### Métricas de Produção e Receita (Valores)
| Coluna | Descrição | Tipo |
|:---|:---|:---|
| `poc` | Produção Bruta (Point of Contact) | Moeda |
| `receita_liquida` | Produção Bruta deduzida de impostos | Moeda |
| `perc_impostos` | Percentual médio de impostos aplicado | Porcentagem |

### Métricas de Custo (Valores)
| Coluna | Descrição | Tipo |
|:---|:---|:---|
| `mo_obra` | Custo Real de Mão de Obra | Moeda |
| `materiais` | Custo Real de Materiais | Moeda |
| `custo_direto_real` | Soma de MO, Mat, Transp, Equip, Indir | Moeda |
| `custo_direto_orcado` | Custo orçado baseado na produção (POC) | Moeda |
| `resultado_direto` | Delta (Orçado - Real) do custo direto | Moeda |
| `custo_total_real` | Custo Direto + Gerência Real | Moeda |
| `custo_total_orcado` | Custo Total Orçado (incl. Riscos/Inflação) | Moeda |
| `resultado_total` | Resultado final do mês (Orçado - Real) | Moeda |

### Métricas de Margem (Valores)
| Coluna | Descrição | Tipo |
|:---|:---|:---|
| `mb_real` | Margem Bruta Real (Receita Líq - Custo Total Real) | Moeda |
| `mb_orcada` | Margem Bruta Orçada (Receita Líq - Custo Total Orç) | Moeda |
| `perc_mb_real` | Margem Real em % sobre a Receita Líquida | Porcentagem |
| `perc_mb_orcada` | Margem Orçada em % sobre a Receita Líquida | Porcentagem |

### Faturamento
| Coluna | Descrição | Tipo |
|:---|:---|:---|
| `faturamento_bruto` | Valor total das notas emitidas no mês | Moeda |
| `faturamento_liquido`| Valor das notas deduzido de retenções | Moeda |

## Dicas de Modelagem no Power BI

1. **Calendário**: Crie uma tabela `Calendário` no Power BI e ligue a coluna `Date` com a coluna `mes` da view.
2. **Medidas DAX**: 
   - Utilize as colunas acima para criar somas (SUM) ou médias (AVERAGE).
   - Exemplo de Medida MB%: `DIVIDE(SUM(view_bi_analise_obras[mb_real]), SUM(view_bi_analise_obras[receita_liquida]), 0)`
3. **Filtros**: Use `projeto_status` para filtrar apenas obras "em andamento" ou "concluídas" conforme necessário.
