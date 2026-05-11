import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ColumnHeader, SortDir } from "@/components/medicoes/ColumnHeader";
import { Button } from "@/components/ui/button";
import { ClipboardList, RefreshCw } from "lucide-react";
import { FCAModal } from "./FCAModal";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const CATEGORIAS = [
  "Mão de Obra",
  "Materiais",
  "Transporte",
  "Indiretos",
  "Gerência",
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
  receitaLiquida: number;
  custoOrcado: number;
  custoOrcadoGerencia: number;
  custoRealGerencia: number;
  categorias: Record<string, number>;
  totalErp: number;
}

type ColumnKey = "area" | "projeto" | "cliente" | "referencia" | "valorProduzido" | "receitaLiquida" | "custoOrcado" | "totalErp" | "resultadoDireto" | "mbOrcada" | "mbRealizado" | "mbPctOrcado" | "mbPctRealizado" | "custoOrcadoGerencia" | "custoRealGerencia" | "gerPctOrcado" | "gerPctRealizado" | string;

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
  const [fcaState, setFcaState] = useState({
    open: false,
    projetoId: "",
    projetoNome: "",
    mesReferencia: "",
    mesLabel: "",
  });

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

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["analise_custos_matrix_mensal", projetoIds, startDate, endDate],
    staleTime: Infinity,
    queryFn: async (): Promise<MonthRow[]> => {
      if (projetoIds.length === 0) return [];

      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, codigo, nome, area_id, cliente_id, areas(nome), clientes(razao_social)")
        .in("id", projetoIds);

      if (!projetos) return [];

      const { data: producaoData } = await supabase
        .from("view_producao_diario")
        .select("projeto_id, item_lpu_id, valor_produzido, data_producao, mes, ano")
        .in("projeto_id", projetoIds)
        .gte("data_producao", startDate)
        .lte("data_producao", endDate);

      const { data: faturamentosData } = await supabase
        .from("faturamentos")
        .select("projeto_id, valor_liquido, valor_bruto, data_emissao")
        .in("projeto_id", projetoIds)
        .gte("data_emissao", startDate)
        .lte("data_emissao", endDate);

      const taxRates: Record<string, number> = {};
      projetoIds.forEach(pid => {
        const projs = (faturamentosData || []).filter(f => f.projeto_id === pid);
        if (projs.length > 0) {
          const totalBruto = projs.reduce((a, b) => a + Number(b.valor_bruto || 0), 0);
          const totalLiquido = projs.reduce((a, b) => a + Number(b.valor_liquido || 0), 0);
          taxRates[pid] = totalBruto > 0 ? totalLiquido / totalBruto : 0.94;
        } else {
          taxRates[pid] = 0.94;
        }
      });

      const { data: itensLpu } = await supabase
        .from("itens_lpu")
        .select("id, bdi");
      const bdiMap: Record<string, number> = {};
      (itensLpu || []).forEach(il => { bdiMap[il.id] = Number(il.bdi) || 1; });

      const { data: erpData } = await (supabase as any)
        .from("custo_real_erp")
        .select("projeto_id, categoria_interna, valor, data_competencia")
        .in("projeto_id", projetoIds)
        .gte("data_competencia", startDate)
        .lte("data_competencia", endDate);

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

          const myProd = (producaoData || []).filter(p =>
            p.projeto_id === proj.id && Number(p.mes) === mesNum && Number(p.ano) === anoNum
          );

          let valorProduzido = 0;
          let custoOrcado = 0;
          for (const p of myProd) {
            valorProduzido += Number(p.valor_produzido || 0);
            const bdi = bdiMap[p.item_lpu_id] || 1;
            custoOrcado += Number(p.valor_produzido || 0) / bdi;
          }

          const myErp = (erpData || []).filter((e: any) => 
            e.projeto_id === proj.id && e.data_competencia >= monthStart && e.data_competencia <= monthEnd
          );

          const categorias: Record<string, number> = {};
          CATEGORIAS.forEach(cat => { categorias[cat] = 0; });
          let custoRealGerencia = 0;
          myErp.forEach((e: any) => {
            const cat = e.categoria_interna || "Indiretos";
            if (cat === "Gerência") custoRealGerencia += Number(e.valor || 0);
            if (categorias[cat] !== undefined) categorias[cat] += Number(e.valor || 0);
            else categorias["Indiretos"] += Number(e.valor || 0);
          });

          const totalErp = Object.values(categorias).reduce((a, b) => a + b, 0);
          const receitaLiquida = valorProduzido * (taxRates[proj.id] || 0.94);
          const custoOrcadoGerencia = custoOrcado * 0.15;

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
              receitaLiquida,
              custoOrcado,
              custoOrcadoGerencia,
              custoRealGerencia,
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
    if (col === "valorProduzido") return row.valorProduzido;
    if (col === "receitaLiquida") return row.receitaLiquida;
    if (col === "custoOrcado") return row.custoOrcado;
    if (col === "totalErp") return row.totalErp;
    if (col === "mbOrcada") return row.receitaLiquida - row.custoOrcado;
    if (col === "mbRealizado") return row.receitaLiquida - row.totalErp;
    if (col === "mbPctOrcado") return row.receitaLiquida ? ((row.receitaLiquida - row.custoOrcado) / row.receitaLiquida) * 100 : 0;
    if (col === "mbPctRealizado") return row.receitaLiquida ? ((row.receitaLiquida - row.totalErp) / row.receitaLiquida) * 100 : 0;
    if (col === "custoOrcadoGerencia") return row.custoOrcadoGerencia;
    if (col === "custoRealGerencia") return row.custoRealGerencia;
    if (col === "gerPctOrcado") return row.receitaLiquida ? (row.custoOrcadoGerencia / row.receitaLiquida) * 100 : 0;
    if (col === "gerPctRealizado") return row.receitaLiquida ? (row.custoRealGerencia / row.receitaLiquida) * 100 : 0;
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
      if (f.search) filtered = filtered.filter(r => getStringVal(r, col).toLowerCase().includes(f.search.toLowerCase()));
      if (f.selected.size > 0) filtered = filtered.filter(r => f.selected.has(getStringVal(r, col)));
    });
    if (sortCol && sortDir) {
      const isText = (textCols as readonly string[]).includes(sortCol);
      filtered.sort((a, b) => {
        const cmp = isText ? (sortCol === "referencia" ? a.refSort.localeCompare(b.refSort) : getStringVal(a, sortCol).localeCompare(getStringVal(b, sortCol), "pt-BR")) : (getNumVal(a, sortCol) - getNumVal(b, sortCol));
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return filtered;
  }, [rows, filters, sortCol, sortDir, getFilter, getStringVal, getNumVal]);

  const totals = useMemo(() => ({
    valorProduzido: processedRows.reduce((a, r) => a + r.valorProduzido, 0),
    receitaLiquida: processedRows.reduce((a, r) => a + r.receitaLiquida, 0),
    custoOrcado: processedRows.reduce((a, r) => a + r.custoOrcado, 0),
    custoOrcadoGerencia: processedRows.reduce((a, r) => a + r.custoOrcadoGerencia, 0),
    custoRealGerencia: processedRows.reduce((a, r) => a + r.custoRealGerencia, 0),
    totalErp: processedRows.reduce((a, r) => a + r.totalErp, 0),
    categorias: CATEGORIAS.reduce((acc, cat) => {
      acc[cat] = processedRows.reduce((a, r) => a + (r.categorias[cat] || 0), 0);
      return acc;
    }, {} as Record<string, number>),
  }), [processedRows]);

  const makeSortDir = (col: ColumnKey): SortDir => sortCol === col ? sortDir : null;
  const makeToggle = (col: string) => (v: string) => setFilterField(col, prev => {
    const next = new Set(prev.selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    return { ...prev, selected: next };
  });
  const makeSelectAll = (col: string) => () => setFilterField(col, prev => ({ ...prev, selected: new Set(uniqueValues[col] || []) }));
  const makeClearAll = (col: string) => () => setFilterField(col, prev => ({ ...prev, selected: new Set() }));
  const makeSearchChange = (col: string) => (v: string) => setFilterField(col, prev => ({ ...prev, search: v }));

  const NumericHeader = ({ label, col, className }: { label: string; col: ColumnKey; className?: string }) => {
    const dir = makeSortDir(col);
    return (
      <th className={`py-3 px-4 font-semibold text-right ${className || ""}`}>
        <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium ml-auto">
          {label}
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅"}
        </button>
      </th>
    );
  };

  const textColLabels: Record<string, string> = { area: "Área", projeto: "Projeto", cliente: "Cliente", referencia: "Referência" };

  return (
    <Card>
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle>Matriz de Custos</CardTitle>
          <CardDescription>Produção, Custo Orçado, Despesas por Categoria e Total Real (ERP)</CardDescription>
        </div>
        {isFetching && <div className="text-xs text-muted-foreground animate-pulse">Atualizando...</div>}
      </CardHeader>
      <div className="w-full overflow-x-auto relative">
        <table className="w-full text-sm text-left border-separate border-spacing-0 whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold border-r border-b sticky left-0 z-20 bg-muted">FCA</th>
                <th className="py-3 px-4 font-semibold border-r border-b sticky left-[64px] z-20 bg-muted">
                  <ColumnHeader label="Referência" sortDir={makeSortDir("referencia")} onSort={() => handleSort("referencia")} searchText={getFilter("referencia").search} onSearchChange={makeSearchChange("referencia")} uniqueValues={uniqueValues["referencia"] || []} selectedValues={getFilter("referencia").selected} onToggleValue={makeToggle("referencia")} onSelectAll={makeSelectAll("referencia")} onClearAll={makeClearAll("referencia")} />
                </th>
                <th className="py-3 px-4 font-semibold border-r border-b sticky left-[164px] z-20 bg-muted">
                  <ColumnHeader label="Área" sortDir={makeSortDir("area")} onSort={() => handleSort("area")} searchText={getFilter("area").search} onSearchChange={makeSearchChange("area")} uniqueValues={uniqueValues["area"] || []} selectedValues={getFilter("area").selected} onToggleValue={makeToggle("area")} onSelectAll={makeSelectAll("area")} onClearAll={makeClearAll("area")} />
                </th>
                <th className="py-3 px-4 font-semibold border-r border-b sticky left-[264px] z-20 bg-muted">
                  <ColumnHeader label="Projeto" sortDir={makeSortDir("projeto")} onSort={() => handleSort("projeto")} searchText={getFilter("projeto").search} onSearchChange={makeSearchChange("projeto")} uniqueValues={uniqueValues["projeto"] || []} selectedValues={getFilter("projeto").selected} onToggleValue={makeToggle("projeto")} onSelectAll={makeSelectAll("projeto")} onClearAll={makeClearAll("projeto")} />
                </th>
                <th className="py-3 px-4 font-semibold border-r border-b sticky left-[464px] z-20 bg-muted">
                  <ColumnHeader label="Cliente" sortDir={makeSortDir("cliente")} onSort={() => handleSort("cliente")} searchText={getFilter("cliente").search} onSearchChange={makeSearchChange("cliente")} uniqueValues={uniqueValues["cliente"] || []} selectedValues={getFilter("cliente").selected} onToggleValue={makeToggle("cliente")} onSelectAll={makeSelectAll("cliente")} onClearAll={makeClearAll("cliente")} />
                </th>
                <NumericHeader label="Produção (R$)" col="valorProduzido" className="bg-emerald-50 dark:bg-emerald-950/30 border-r border-b sticky left-[624px] z-20" />
                {CATEGORIAS.map(cat => <NumericHeader key={cat} label={`${cat} (R$)`} col={cat} className="border-r border-b" />)}
                <NumericHeader label="Custo Real" col="totalErp" className="bg-red-50 dark:bg-red-950/30 border-r border-b" />
                <NumericHeader label="Custo Orçado" col="custoOrcado" className="bg-blue-50 dark:bg-blue-950/30 border-r border-b" />
                
                {/* Yellow Group - Lucro Bruto */}
                <NumericHeader label="Receita Líquida" col="receitaLiquida" className="bg-amber-100 dark:bg-amber-900/40 border-r border-b" />
                <NumericHeader label="MB Orçada" col="mbOrcada" className="bg-amber-100 dark:bg-amber-900/40 border-r border-b" />
                <NumericHeader label="MB Realizado" col="mbRealizado" className="bg-amber-100 dark:bg-amber-900/40 border-r border-b" />
                <NumericHeader label="MB (%) Orçado" col="mbPctOrcado" className="bg-amber-100 dark:bg-amber-900/40 border-r border-b" />
                <NumericHeader label="MB (%) Realizado" col="mbPctRealizado" className="bg-amber-100 dark:bg-amber-900/40 border-r border-b" />
                
                {/* Blue Group - Gerencia Obra */}
                <NumericHeader label="Orçado Gerência" col="custoOrcadoGerencia" className="bg-blue-100 dark:bg-blue-900/40 border-r border-b" />
                <NumericHeader label="Real Gerência" col="custoRealGerencia" className="bg-blue-100 dark:bg-blue-900/40 border-r border-b" />
                <NumericHeader label="% Ger. Orçado" col="gerPctOrcado" className="bg-blue-100 dark:bg-blue-900/40 border-r border-b" />
                <NumericHeader label="% Ger. Real" col="gerPctRealizado" className="bg-blue-100 dark:bg-blue-900/40 border-b" />
              </tr>
            </thead>
            <tbody>
              {processedRows.map((row) => {
                const mbOrc = row.receitaLiquida - row.custoOrcado;
                const mbReal = row.receitaLiquida - row.totalErp;
                const mbPctOrc = row.receitaLiquida ? (mbOrc / row.receitaLiquida) * 100 : 0;
                const mbPctReal = row.receitaLiquida ? (mbReal / row.receitaLiquida) * 100 : 0;
                const gerPctOrc = row.receitaLiquida ? (row.custoOrcadoGerencia / row.receitaLiquida) * 100 : 0;
                const gerPctReal = row.receitaLiquida ? (row.custoRealGerencia / row.receitaLiquida) * 100 : 0;
                
                return (
                  <tr key={row.key} className="hover:bg-muted/30 transition-colors border-b">
                    <td className="py-2 px-4 border-r text-center sticky left-0 z-10 bg-background">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setFcaState({ open: true, projetoId: row.projetoId, projetoNome: `${row.codigo} - ${row.nome}`, mesReferencia: row.refSort, mesLabel: row.referencia })}>
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="py-2 px-4 border-r text-center sticky left-[64px] z-10 bg-background">{row.referencia}</td>
                    <td className="py-2 px-4 border-r truncate max-w-[120px] sticky left-[164px] z-10 bg-background">{row.area}</td>
                    <td className="py-2 px-4 border-r truncate max-w-[200px] sticky left-[264px] z-10 bg-background">{row.codigo} - {row.nome}</td>
                    <td className="py-2 px-4 border-r truncate max-w-[160px] sticky left-[464px] z-10 bg-background">{row.cliente}</td>
                    <td className="py-2 px-4 text-right border-r font-mono text-emerald-600 bg-emerald-50/30 sticky left-[624px] z-10">{formatCurrency(row.valorProduzido)}</td>
                    {CATEGORIAS.map(cat => <td key={cat} className="py-2 px-4 text-right border-r font-mono">{formatCurrency(row.categorias[cat] || 0)}</td>)}
                    <td className="py-2 px-4 text-right border-r font-mono font-bold text-destructive bg-red-50/30">{formatCurrency(row.totalErp)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono text-blue-600 bg-blue-50/30">{formatCurrency(row.custoOrcado)}</td>
                    
                    {/* Yellow columns */}
                    <td className="py-2 px-4 text-right border-r font-mono bg-amber-100/30">{formatCurrency(row.receitaLiquida)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-amber-100/30">{formatCurrency(mbOrc)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-amber-100/30">{formatCurrency(mbReal)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-amber-100/30">{formatPercent(mbPctOrc)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-amber-100/30">{formatPercent(mbPctReal)}</td>
                    
                    {/* Blue columns */}
                    <td className="py-2 px-4 text-right border-r font-mono bg-blue-100/30">{formatCurrency(row.custoOrcadoGerencia)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-blue-100/30">{formatCurrency(row.custoRealGerencia)}</td>
                    <td className="py-2 px-4 text-right border-r font-mono bg-blue-100/30">{formatPercent(gerPctOrc)}</td>
                    <td className="py-2 px-4 text-right font-mono bg-blue-100/30">{formatPercent(gerPctReal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted font-bold">
              <tr>
                <td colSpan={1} className="py-2 px-4 border-r border-t text-right sticky left-0 z-10 bg-muted">Totais:</td>
                <td className="py-2 px-4 border-r border-t sticky left-[64px] z-10 bg-muted"></td>
                <td className="py-2 px-4 border-r border-t sticky left-[164px] z-10 bg-muted"></td>
                <td className="py-2 px-4 border-r border-t sticky left-[264px] z-10 bg-muted"></td>
                <td className="py-2 px-4 border-r border-t sticky left-[464px] z-10 bg-muted"></td>
                <td className="py-2 px-4 text-right border-r border-t sticky left-[624px] z-10 bg-muted">{formatCurrency(totals.valorProduzido)}</td>
                {CATEGORIAS.map(cat => <td key={cat} className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.categorias[cat] || 0)}</td>)}
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.totalErp)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.custoOrcado)}</td>
                
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.receitaLiquida)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.receitaLiquida - totals.custoOrcado)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.receitaLiquida - totals.totalErp)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatPercent(totals.receitaLiquida ? ((totals.receitaLiquida - totals.custoOrcado) / totals.receitaLiquida) * 100 : 0)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatPercent(totals.receitaLiquida ? ((totals.receitaLiquida - totals.totalErp) / totals.receitaLiquida) * 100 : 0)}</td>
                
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.custoOrcadoGerencia)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatCurrency(totals.custoRealGerencia)}</td>
                <td className="py-2 px-4 text-right border-r border-t">{formatPercent(totals.receitaLiquida ? (totals.custoOrcadoGerencia / totals.receitaLiquida) * 100 : 0)}</td>
                <td className="py-2 px-4 text-right border-t">{formatPercent(totals.receitaLiquida ? (totals.custoRealGerencia / totals.receitaLiquida) * 100 : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <FCAModal projetoId={fcaState.projetoId} projetoNome={fcaState.projetoNome} mesReferencia={fcaState.mesReferencia} mesLabel={fcaState.mesLabel} open={fcaState.open} onOpenChange={open => setFcaState(prev => ({ ...prev, open }))} />
    </Card>
  );
}
