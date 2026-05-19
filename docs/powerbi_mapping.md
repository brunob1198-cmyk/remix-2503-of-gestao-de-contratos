# Mapeamento Power BI - Análise de Obras

Este documento descreve o mapeamento das colunas da view `view_bi_analise_obras` para utilização no Power BI, classificando-as entre Dimensões (Atributos) e Fatos (Métricas).

## Conexão
- **Fonte**: PostgreSQL / Supabase
- **View**: `public.view_bi_analise_obras`

## Dimensões (Atributos para Filtros e Eixos)

| Coluna | Descrição | Tipo |
|:---|:---|:---|
| `projeto_id` | ID único do projeto (Chave para relação com Tabela Projetos) | UUID |
| `mes` | Data de início do mês de referência | Date |
| `ano` | Ano de referência (ex: 2026) | Integer |
| `mes_numero` | Número do mês (1-12) | Integer |
| `ano_mes` | Texto no formato YYYY-MM para ordenação | Text |
| `referencia` | Texto no formato MM/YYYY para exibição | Text |
| `projeto_codigo` | Código identificador da obra (ex: R015.25) | Text |
| `projeto_nome` | Nome completo da obra | Text |
| `projeto_status` | Status atual do projeto (ativo, concluído, etc) | Text |
| `area_nome` | Unidade de negócio / Área analítica | Text |
| `cliente` | Razão Social do Cliente | Text |
| `empresa_nome` | Nome da empresa executora | Text |

## Fatos (Métricas Financeiras e Performance)

### Receita e Produção
| Coluna | Descrição | Cálculo / Significado |
|:---|:---|:---|
| `poc` | Produção Bruta (POC) | Soma de `diario_producao.valor_total` |
| `perc_impostos` | Percentual de Impostos | Alíquota configurada no projeto |
| `receita_liquida` | Produção Líquida | `poc * (1 - perc_impostos)` |
| `faturamento_bruto` | Faturamento Emitido | Notas fiscais emitidas no período |

### Custos Diretos
| Coluna | Descrição | Cálculo / Significado |
|:---|:---|:---|
| `custo_direto_orcado` | Custo Direto Previsto | `Produção / BDI` (Item ou Projeto) |
| `custo_direto_real` | Custo Direto Realizado | Lançamentos ERP (exceto Gerência/Financeiro) |
| `resultado_direto` | Delta Custo Direto | `custo_direto_orcado - custo_direto_real` |
| `mo_obra` | Custo de Mão de Obra | Categoria 'Mão de Obra' no ERP |
| `materiais` | Custo de Materiais | Categoria 'Materiais' no ERP |
| `transporte` | Custo de Transporte | Categoria 'Transporte' no ERP |
| `equipamentos` | Custo de Equipamentos | Categoria 'Equipamentos' no ERP |
| `indiretos` | Custos Indiretos | Categoria 'Indiretos' no ERP |

### Gerência e Administrativo
| Coluna | Descrição | Cálculo / Significado |
|:---|:---|:---|
| `gerencia_orcada` | Gerência Orçada | `custo_direto_orcado * % Gerência MKP` |
| `gerencia_real` | Gerência Realizada | Lançamentos categoria 'Gerência' no ERP |
| `gerencia_resultado` | Delta Gerência | `gerencia_orcada - gerencia_real` |

### Totais e Margens
| Coluna | Descrição | Cálculo / Significado |
|:---|:---|:---|
| `custo_total_orcado` | Custo Total Orçado | CDO ajustado por Risco, Inflação e Treinamento |
| `custo_total_real` | Custo Total Realizado | `custo_direto_real + gerencia_real` |
| `resultado_total` | Resultado (Lucro/Prejuízo) | `custo_total_orcado - custo_total_real` |
| `mb_orcada` | Margem Bruta Orçada | `receita_liquida - custo_total_orcado` |
| `mb_real` | Margem Bruta Realizada | `receita_liquida - custo_total_real` |
| `perc_mb_orcada` | % Margem Bruta Orçada | `mb_orcada / receita_liquida` |
| `perc_mb_real` | % Margem Bruta Realizada | `mb_real / receita_liquida` |
| `perc_mb_mkp` | % MB de Referência (MKP) | Meta de margem definida no orçamento inicial |

---
**Dica para Power BI**: Utilize a coluna `ano_mes` para ordenar o eixo de tempo e a coluna `projeto_id` para relacionar com outras tabelas auxiliares.
