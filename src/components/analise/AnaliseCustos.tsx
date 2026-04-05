import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
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

interface ProjetoRow {
  id: string;
  codigo: string;
  nome: string;
  area: string;
  cliente: string;
  valorProduzido: number;
  custoOrcado: number;
  categorias: Record<string, number>;
  totalErp: number;
}

type ColumnKey = "area" | "projeto" | "cliente" | "valorProduzido" | "custoOrcado" | "totalErp" | string;

interface FilterState {
  search: string;
  selected: Set<string>;
}

const emptyFilter = (): FilterState => ({ search: "", selected: new Set() });

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const startDate = format(startOfMonth(periodoInicio), "yyyy-MM-dd");
  const endDate = format(endOfMonth(periodoFim), "yyyy-MM-dd");

  // Sort state
  const [sortCol, setSortCol] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Filter state per column
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
    queryKey: ["analise_custos_matrix", projetoIds, startDate, endDate],
    queryFn: async () => {
      if (projetoIds.length === 0) return [];

      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, codigo, nome, area_id, cliente_id, areas(nome), clientes(razao_social)")
        .in("id", projetoIds)
        .order("codigo");

      if (!projetos || projetos.length === 0) return [];

      const { data: allSites } = await supabase
        .from("sites")
        .select("id, projeto_id")
        .in("projeto_id", projetoIds);

      const sitesByProjeto: Record<string, string[]> = {};
      (allSites || []).forEach(s => {
        if (!sitesByProjeto[s.projeto_id]) sitesByProjeto[s.projeto_id] = [];
        sitesByProjeto[s.projeto_id].push(s.id);
      });

      const allSiteIds = (allSites || []).map(s => s.id);

      const { data: escopoItens } = allSiteIds.length > 0
        ? await supabase.from("escopo_itens").select("site_id, quantidade, custo_unitario, valor_unitario").in("site_id", allSiteIds)
        : { data: [] };

      let erpQuery = (supabase as any).from("custo_real_erp").select("projeto_id, categoria_interna, valor")
        .in("projeto_id", projetoIds);
      if (startDate) {
        erpQuery = erpQuery.gte("data_pagamento", startDate).lte("data_pagamento", endDate);
      }
      const { data: erpData } = await erpQuery;

      const result: ProjetoRow[] = projetos.map((p: any) => {
        const mySiteIds = sitesByProjeto[p.id] || [];
        const myEscopo = (escopoItens || []).filter((e: any) => mySiteIds.includes(e.site_id));

        let custoOrcado = 0;
        let valorProduzido = 0;
        for (const item of myEscopo) {
          custoOrcado += Number(item.custo_unitario || 0) * Number(item.quantidade || 0);
          valorProduzido += Number(item.valor_unitario || 0) * Number(item.quantidade || 0);
        }

        const myErp = (erpData || []).filter((e: any) => e.projeto_id === p.id);
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

        return {
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          area: p.areas?.nome || "-",
          cliente: p.clientes?.razao_social || "-",
          valorProduzido,
          custoOrcado,
          categorias,
          totalErp,
        };
      });

      return result;
    },
    enabled: projetoIds.length > 0,
  });

  // Helper to get string value for a column
  const getStringVal = useCallback((row: ProjetoRow, col: ColumnKey): string => {
    if (col === "area") return row.area;
    if (col === "projeto") return `${row.codigo} - ${row.nome}`;
    if (col === "cliente") return row.cliente;
    if (col === "valorProduzido") return formatCurrency(row.valorProduzido);
    if (col === "custoOrcado") return formatCurrency(row.custoOrcado);
    if (col === "totalErp") return formatCurrency(row.totalErp);
    // categoria
    return formatCurrency(row.categorias[col] || 0);
  }, []);

  const getNumVal = useCallback((row: ProjetoRow, col: ColumnKey): number => {
    if (col === "valorProduzido") return row.valorProduzido;
    if (col === "custoOrcado") return row.custoOrcado;
    if (col === "totalErp") return row.totalErp;
    if (CATEGORIAS.includes(col)) return row.categorias[col] || 0;
    return 0;
  }, []);

  // Unique values per column
  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    const allCols: ColumnKey[] = ["area", "projeto", "cliente"];
    allCols.forEach(col => {
      const vals = [...new Set(rows.map(r => getStringVal(r, col)))].sort();
      result[col] = vals;
    });
    return result;
  }, [rows, getStringVal]);

  // Filtered + sorted rows
  const processedRows = useMemo(() => {
    let filtered = [...rows];

    // Apply text filters for text columns
    (["area", "projeto", "cliente"] as ColumnKey[]).forEach(col => {
      const f = getFilter(col);
      if (f.search) {
        filtered = filtered.filter(r => getStringVal(r, col).toLowerCase().includes(f.search.toLowerCase()));
      }
      if (f.selected.size > 0) {
        filtered = filtered.filter(r => f.selected.has(getStringVal(r, col)));
      }
    });

    // Sort
    if (sortCol && sortDir) {
      const isNumeric = sortCol !== "area" && sortCol !== "projeto" && sortCol !== "cliente";
      filtered.sort((a, b) => {
        let cmp: number;
        if (isNumeric) {
          cmp = getNumVal(a, sortCol) - getNumVal(b, sortCol);
        } else {
          cmp = getStringVal(a, sortCol).localeCompare(getStringVal(b, sortCol), "pt-BR");
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return filtered;
  }, [rows, filters, sortCol, sortDir, getFilter, getStringVal, getNumVal]);

  // Totals from filtered rows
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

  // For numeric columns we use sort-only header (no multi-select filter)
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

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle>Matriz de Custos</CardTitle>
        <CardDescription>Produção, Custo Orçado, Despesas por Categoria e Total Real (ERP)</CardDescription>
      </CardHeader>
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {/* Text columns with full filter */}
                {(["area", "projeto", "cliente"] as const).map(col => {
                  const labels: Record<string, string> = { area: "Área", projeto: "Projeto", cliente: "Cliente" };
                  return (
                    <th key={col} className="py-3 px-4 font-semibold border-r">
                      <ColumnHeader
                        label={labels[col]}
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
                  );
                })}
                {/* Numeric columns with sort */}
                <NumericHeader label="Produção (R$)" col="valorProduzido" className="bg-emerald-50 dark:bg-emerald-950/30 border-r" />
                <NumericHeader label="Custo Orçado (R$)" col="custoOrcado" className="bg-blue-50 dark:bg-blue-950/30 border-r" />
                {CATEGORIAS.map(cat => (
                  <NumericHeader key={cat} label={`${cat} (R$)`} col={cat} className="border-r last:border-r-0" />
                ))}
                <NumericHeader label="Custo Real (R$)" col="totalErp" className="bg-red-50 dark:bg-red-950/30 border-l-2 border-primary/20" />
              </tr>
            </thead>
            <tbody>
              {processedRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors border-b">
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
                    <td key={cat} className="py-2.5 px-4 text-right font-mono border-r last:border-r-0">
                      {formatCurrency(row.categorias[cat] || 0)}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(row.totalErp)}
                  </td>
                </tr>
              ))}
              {processedRows.length > 1 && (
                <tr className="bg-muted/50 font-bold border-t-2">
                  <td className="py-3 px-4 border-r" colSpan={3}>Total</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                    {formatCurrency(totals.valorProduzido)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                    {formatCurrency(totals.custoOrcado)}
                  </td>
                  {CATEGORIAS.map((cat) => (
                    <td key={cat} className="py-3 px-4 text-right font-mono border-r last:border-r-0">
                      {formatCurrency(totals.categorias[cat] || 0)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(totals.totalErp)}
                  </td>
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
