import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ColumnHeader, SortDir } from "@/components/medicoes/ColumnHeader";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const CATEGORIAS = [
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Transporte",
  "Indiretos",
  "Financeiros",
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatPercent = (val: number) =>
  isFinite(val) ? `${val.toFixed(1)}%` : "—";

interface MonthRow {
  key: string; // projetoId + mesRef
  projetoId: string;
  codigo: string;
  nome: string;
  area: string;
  cliente: string;
  referencia: string; // "Mar/2026"
  refSort: string; // "2026-03" for sorting
  valorProduzido: number;
  custoOrcado: number;
  categorias: Record<string, number>;
  totalErp: number;
}

type ColumnKey = "area" | "projeto" | "cliente" | "referencia" | "valorProduzido" | "custoOrcado" | "totalErp" | "mbOrcada" | "mbRealizado" | "mbPctOrcado" | "mbPctRealizado" | string;

interface FilterState {
  search: string;
  selected: Set<string>;
}

const emptyFilter = (): FilterState => ({ search: "", selected: new Set() });

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const startDate = format(startOfMonth(periodoInicio), "yyyy-MM-dd");
  const endDate = format(endOfMonth(periodoFim), "yyyy-MM-dd");

  const [sortCol, setSortCol] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, FilterState>>({});

  const getFilter = useCallback((key: string): FilterState => filters[key] || emptyFilter(), [filters]);

  const setFilterField = useCallback((key: string, updater: (prev: FilterState) => FilterState) => {
    setFilters(prev => ({ ...prev, [key]: updater(prev[key] || emptyFilter()) }));
  }, []);

  const handleSort = useCallback((col: ColumnKey) => {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : prev === "desc" ? null : "asc");
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol, sortDir]);

  const { data: rows = [] } = useQuery({
    queryKey: ["analise_custos_matrix_mensal", projetoIds, startDate, endDate],
    queryFn: async (): Promise<MonthRow[]> => {
      if (projetoIds.length === 0) return [];

      // Fetch projetos info
      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, codigo, nome, area_id, cliente_id, areas(nome), clientes(razao_social)")
        .in("id", projetoIds)
        .order("codigo");

      if (!projetos || projetos.length === 0) return [];

      // Fetch production from view_producao_diario
      const { data: producaoData } = await supabase
        .from("view_producao_diario")
        .select("projeto_id, item_lpu_id, quantidade, preco_unitario, valor_produzido, data_producao, mes, ano")
        .in("projeto_id", projetoIds)
        .gte("data_producao", startDate)
        .lte("data_producao", endDate);

      // Fetch itens_lpu for BDI
      const itemIds = [...new Set((producaoData || []).map((p: any) => p.item_lpu_id).filter(Boolean))];
      let bdiMap: Record<string, number> = {};
      if (itemIds.length > 0) {
        const { data: itensLpu } = await supabase
          .from("itens_lpu")
          .select("id, bdi")
          .in("id", itemIds);
        (itensLpu || []).forEach((il: any) => { bdiMap[il.id] = Number(il.bdi) || 1; });
      }

      // Fetch disabled ERP categories
      const { data: disabledCats } = await supabase
        .from("mapeamento_categorias_erp")
        .select("categoria_erp")
        .eq("ativo", false);
      const disabledSet = new Set((disabledCats || []).map((d: any) => d.categoria_erp));

      // Fetch ERP costs by data_competencia (filter disabled categories) — paginated
      const BATCH_SIZE = 1000;
      const allErpData: any[] = [];
      let erpOffset = 0;
      let erpHasMore = true;

      while (erpHasMore) {
        const { data: batch } = await (supabase as any)
          .from("custo_real_erp")
          .select("projeto_id, categoria_interna, categoria_erp, valor, data_competencia, centro_custo")
          .in("projeto_id", projetoIds)
          .gte("data_competencia", startDate)
          .lte("data_competencia", endDate)
          .range(erpOffset, erpOffset + BATCH_SIZE - 1);
        const rows = batch || [];
        allErpData.push(...rows);
        erpHasMore = rows.length === BATCH_SIZE;
        erpOffset += BATCH_SIZE;
      }

      const erpData = allErpData.filter((e: any) => !disabledSet.has(e.categoria_erp) && e.centro_custo?.trim() !== "Reforma Sede Jardim América");

      // Generate all months in range
      const months = eachMonthOfInterval({ start: periodoInicio, end: periodoFim });

      const result: MonthRow[] = [];

      for (const proj of projetos as any[]) {
        for (const month of months) {
          const mesNum = month.getMonth() + 1;
          const anoNum = month.getFullYear();
          const mesKey = format(month, "yyyy-MM");
          const mesLabel = format(month, "MMM/yyyy", { locale: ptBR });
          const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
          const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

          // Production for this project+month
          const myProd = (producaoData || []).filter((p: any) =>
            p.projeto_id === proj.id &&
            Number(p.mes) === mesNum &&
            Number(p.ano) === anoNum
          );

          let valorProduzido = 0;
          let custoOrcado = 0;
          for (const p of myProd) {
            const qty = Number(p.quantidade || 0);
            const preco = Number(p.preco_unitario || 0);
            valorProduzido += Number(p.valor_produzido || 0);
            const bdi = bdiMap[p.item_lpu_id] || 1;
            custoOrcado += (preco / bdi) * qty;
          }

          // ERP costs for this project+month
          const myErp = (erpData || []).filter((e: any) => {
            if (e.projeto_id !== proj.id || !e.data_competencia) return false;
            return e.data_competencia >= monthStart && e.data_competencia <= monthEnd;
          });

          const categorias: Record<string, number> = {};
          CATEGORIAS.forEach(cat => { categorias[cat] = 0; });
          myErp.forEach((e: any) => {
            const cat = e.categoria_interna || "Indiretos";
            if (categorias[cat] !== undefined) {
              categorias[cat] += Number(e.valor || 0);
            } else {
              categorias["Indiretos"] += Number(e.valor || 0);
            }
          });

          const totalErp = Object.values(categorias).reduce((a, b) => a + b, 0);

          // Only include rows that have some data
          if (valorProduzido > 0 || totalErp > 0) {
            result.push({
              key: `${proj.id}_${mesKey}`,
              projetoId: proj.id,
              codigo: proj.codigo,
              nome: proj.nome,
              area: proj.areas?.nome || "-",
              cliente: proj.clientes?.razao_social || "-",
              referencia: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
              refSort: mesKey,
              valorProduzido,
              custoOrcado,
              categorias,
              totalErp,
            });
          }
        }
      }

      return result;
    },
    enabled: projetoIds.length > 0,
  });

  const getStringVal = useCallback((row: MonthRow, col: ColumnKey): string => {
    if (col === "area") return row.area;
    if (col === "projeto") return `${row.codigo} - ${row.nome}`;
    if (col === "cliente") return row.cliente;
    if (col === "referencia") return row.referencia;
    return "";
  }, []);

  const getNumVal = useCallback((row: MonthRow, col: ColumnKey): number => {
    if (col === "referencia") return 0; // sorted as string
    if (col === "valorProduzido") return row.valorProduzido;
    if (col === "custoOrcado") return row.custoOrcado;
    if (col === "totalErp") return row.totalErp;
    if (col === "mbOrcada") return row.valorProduzido - row.custoOrcado;
    if (col === "mbRealizado") return row.valorProduzido - row.totalErp;
    if (col === "mbPctOrcado") return row.valorProduzido ? ((row.valorProduzido - row.custoOrcado) / row.valorProduzido) * 100 : 0;
    if (col === "mbPctRealizado") return row.valorProduzido ? ((row.valorProduzido - row.totalErp) / row.valorProduzido) * 100 : 0;
    if (CATEGORIAS.includes(col)) return row.categorias[col] || 0;
    return 0;
  }, []);

  const textCols = ["referencia", "area", "projeto", "cliente"] as const;

  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    textCols.forEach(col => {
      result[col] = [...new Set(rows.map(r => getStringVal(r, col)))].sort();
    });
    return result;
  }, [rows, getStringVal]);

  const processedRows = useMemo(() => {
    let filtered = [...rows];

    textCols.forEach(col => {
      const f = getFilter(col);
      if (f.search) {
        filtered = filtered.filter(r => getStringVal(r, col).toLowerCase().includes(f.search.toLowerCase()));
      }
      if (f.selected.size > 0) {
        filtered = filtered.filter(r => f.selected.has(getStringVal(r, col)));
      }
    });

    if (sortCol && sortDir) {
      const isText = (textCols as readonly string[]).includes(sortCol);
      filtered.sort((a, b) => {
        let cmp: number;
        if (isText) {
          if (sortCol === "referencia") {
            cmp = a.refSort.localeCompare(b.refSort);
          } else {
            cmp = getStringVal(a, sortCol).localeCompare(getStringVal(b, sortCol), "pt-BR");
          }
        } else {
          cmp = getNumVal(a, sortCol) - getNumVal(b, sortCol);
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return filtered;
  }, [rows, filters, sortCol, sortDir, getFilter, getStringVal, getNumVal]);

  const totals = useMemo(() => ({
    valorProduzido: processedRows.reduce((a, r) => a + r.valorProduzido, 0),
    custoOrcado: processedRows.reduce((a, r) => a + r.custoOrcado, 0),
    categorias: CATEGORIAS.reduce((acc, cat) => {
      acc[cat] = processedRows.reduce((a, r) => a + (r.categorias[cat] || 0), 0);
      return acc;
    }, {} as Record<string, number>),
    totalErp: processedRows.reduce((a, r) => a + r.totalErp, 0),
  }), [processedRows]);

  const makeSortDir = (col: ColumnKey): SortDir => sortCol === col ? sortDir : null;

  const makeToggle = (col: string) => (v: string) => {
    setFilterField(col, prev => {
      const next = new Set(prev.selected);
      if (next.has(v)) next.delete(v); else next.add(v);
      return { ...prev, selected: next };
    });
  };

  const makeSelectAll = (col: string) => () => {
    setFilterField(col, prev => ({ ...prev, selected: new Set(uniqueValues[col] || []) }));
  };

  const makeClearAll = (col: string) => () => {
    setFilterField(col, prev => ({ ...prev, selected: new Set() }));
  };

  const makeSearchChange = (col: string) => (v: string) => {
    setFilterField(col, prev => ({ ...prev, search: v }));
  };

  const NumericHeader = ({ label, col, className }: { label: string; col: ColumnKey; className?: string }) => {
    const dir = makeSortDir(col);
    return (
      <th className={`py-3 px-4 font-semibold text-right ${className || ""}`}>
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium">
            {label}
            {dir === "asc" ? <span className="text-xs">▲</span> : dir === "desc" ? <span className="text-xs">▼</span> : <span className="text-xs text-muted-foreground">⇅</span>}
          </button>
        </div>
      </th>
    );
  };

  const textColLabels: Record<string, string> = { area: "Área", projeto: "Projeto", cliente: "Cliente", referencia: "Referência" };

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle>Matriz de Custos</CardTitle>
        <CardDescription>Produção, Custo Orçado, Despesas por Categoria e Total Real (ERP) — por mês de competência</CardDescription>
      </CardHeader>
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {textCols.map(col => (
                  <th key={col} className="py-3 px-4 font-semibold border-r">
                    <ColumnHeader
                      label={textColLabels[col]}
                      sortDir={makeSortDir(col)}
                      onSort={() => handleSort(col)}
                      searchText={getFilter(col).search}
                      onSearchChange={makeSearchChange(col)}
                      uniqueValues={uniqueValues[col] || []}
                      selectedValues={getFilter(col).selected}
                      onToggleValue={makeToggle(col)}
                      onSelectAll={makeSelectAll(col)}
                      onClearAll={makeClearAll(col)}
                    />
                  </th>
                ))}
                <NumericHeader label="Produção (R$)" col="valorProduzido" className="bg-emerald-50 dark:bg-emerald-950/30 border-r" />
                <NumericHeader label="Custo Orçado (R$)" col="custoOrcado" className="bg-blue-50 dark:bg-blue-950/30 border-r" />
                {CATEGORIAS.map(cat => (
                  <NumericHeader key={cat} label={`${cat} (R$)`} col={cat} className="border-r" />
                ))}
                <NumericHeader label="Custo Real" col="totalErp" className="bg-red-50 dark:bg-red-950/30 border-r" />
                <NumericHeader label="MB Orçada (R$)" col="mbOrcada" className="bg-amber-50 dark:bg-amber-950/30 border-r" />
                <NumericHeader label="MB Realizado (R$)" col="mbRealizado" className="bg-amber-50 dark:bg-amber-950/30 border-r" />
                <NumericHeader label="MB (%) Orçado" col="mbPctOrcado" className="bg-amber-50 dark:bg-amber-950/30 border-r" />
                <NumericHeader label="MB (%) Realizado" col="mbPctRealizado" className="bg-amber-50 dark:bg-amber-950/30" />
              </tr>
            </thead>
            <tbody>
              {processedRows.map((row) => {
                const mbOrc = row.valorProduzido - row.custoOrcado;
                const mbReal = row.valorProduzido - row.totalErp;
                const mbPctOrc = row.valorProduzido ? (mbOrc / row.valorProduzido) * 100 : 0;
                const mbPctReal = row.valorProduzido ? (mbReal / row.valorProduzido) * 100 : 0;
                return (
                  <tr key={row.key} className="hover:bg-muted/30 transition-colors border-b">
                    <td className="py-2.5 px-4 border-r font-medium text-center">{row.referencia}</td>
                    <td className="py-2.5 px-4 border-r truncate max-w-[120px]">{row.area}</td>
                    <td className="py-2.5 px-4 border-r font-medium truncate max-w-[200px]">
                      {row.codigo} - {row.nome}
                    </td>
                    <td className="py-2.5 px-4 border-r truncate max-w-[160px]">{row.cliente}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                      {formatCurrency(row.valorProduzido)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                      {formatCurrency(row.custoOrcado)}
                    </td>
                    {CATEGORIAS.map((cat) => (
                      <td key={cat} className="py-2.5 px-4 text-right font-mono border-r">
                        {formatCurrency(row.categorias[cat] || 0)}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                      {formatCurrency(row.totalErp)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatCurrency(mbOrc)}</td>
                    <td className="py-2.5 px-4 text-right font-mono bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatCurrency(mbReal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatPercent(mbPctOrc)}</td>
                    <td className="py-2.5 px-4 text-right font-mono bg-amber-50/50 dark:bg-amber-950/10">{formatPercent(mbPctReal)}</td>
                  </tr>
                );
              })}
              {processedRows.length > 1 && (
                <tr className="bg-muted/50 font-bold border-t-2">
                  <td className="py-3 px-4 border-r" colSpan={4}>Total</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                    {formatCurrency(totals.valorProduzido)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                    {formatCurrency(totals.custoOrcado)}
                  </td>
                  {CATEGORIAS.map((cat) => (
                    <td key={cat} className="py-3 px-4 text-right font-mono border-r">
                      {formatCurrency(totals.categorias[cat] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(totals.totalErp)}
                  </td>
                  {(() => {
                    const mbOrc = totals.valorProduzido - totals.custoOrcado;
                    const mbReal = totals.valorProduzido - totals.totalErp;
                    const mbPctOrc = totals.valorProduzido ? (mbOrc / totals.valorProduzido) * 100 : 0;
                    const mbPctReal = totals.valorProduzido ? (mbReal / totals.valorProduzido) * 100 : 0;
                    return (
                      <>
                        <td className="py-3 px-4 text-right font-mono font-bold bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatCurrency(mbOrc)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatCurrency(mbReal)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold bg-amber-50/50 dark:bg-amber-950/10 border-r">{formatPercent(mbPctOrc)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold bg-amber-50/50 dark:bg-amber-950/10">{formatPercent(mbPctReal)}</td>
                      </>
                    );
                  })()}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
