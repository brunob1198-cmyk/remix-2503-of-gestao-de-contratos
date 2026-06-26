import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { useTableFilters } from "@/hooks/useTableFilters";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Settings2, FileDown, Rows3, ChevronRight, ChevronDown, Sigma, List } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

interface Props {
  projetoId: string;
  selectedSiteIds: string[];
  dataInicio: string;
  dataFim: string;
}

type ColKey =
  | "projeto"
  | "site_codigo"
  | "site_nome"
  | "municipio"
  | "uf"
  | "data"
  | "mes"
  | "clima"
  | "status_ativo"
  | "item_codigo"
  | "item_descricao"
  | "unidade"
  | "quantidade"
  | "preco_unitario"
  | "valor_total"
  | "qtd_medida"
  | "valor_medido"
  | "qtd_faturada"
  | "valor_faturado"
  | "observacoes";

const ALL_COLUMNS: { key: ColKey; label: string; numeric?: boolean; group: string; currency?: boolean; decimal?: boolean }[] = [
  { key: "projeto", label: "Projeto", group: "Identificação" },
  { key: "site_codigo", label: "Site (Código)", group: "Identificação" },
  { key: "site_nome", label: "Site (Nome)", group: "Identificação" },
  { key: "municipio", label: "Município", group: "Localização" },
  { key: "uf", label: "UF", group: "Localização" },
  { key: "data", label: "Data", group: "Diário" },
  { key: "mes", label: "Mês", group: "Diário" },
  { key: "clima", label: "Clima", group: "Diário" },
  { key: "status_ativo", label: "Status Ativo", group: "Diário" },
  { key: "item_codigo", label: "Item (Código)", group: "Item LPU" },
  { key: "item_descricao", label: "Item (Descrição)", group: "Item LPU" },
  { key: "unidade", label: "Unidade", group: "Item LPU" },
  { key: "quantidade", label: "Qtd Produzida", numeric: true, decimal: true, group: "Produção (Diário)" },
  { key: "preco_unitario", label: "Preço Unitário", numeric: true, currency: true, group: "Produção (Diário)" },
  { key: "valor_total", label: "Valor Produzido", numeric: true, currency: true, group: "Produção (Diário)" },
  { key: "qtd_medida", label: "Qtd Medida", numeric: true, decimal: true, group: "Medição" },
  { key: "valor_medido", label: "Valor Medido", numeric: true, currency: true, group: "Medição" },
  { key: "qtd_faturada", label: "Qtd Faturada", numeric: true, decimal: true, group: "Faturamento" },
  { key: "valor_faturado", label: "Valor Faturado", numeric: true, currency: true, group: "Faturamento" },
  { key: "observacoes", label: "Observações", group: "Diário" },
];

const DEFAULT_VISIBLE: ColKey[] = [
  "projeto", "site_codigo", "site_nome", "municipio", "data",
  "item_codigo", "item_descricao", "quantidade", "valor_total",
  "valor_medido", "valor_faturado",
];

const GROUPABLE: ColKey[] = ["projeto", "site_codigo", "site_nome", "municipio", "uf", "mes", "item_codigo", "item_descricao", "status_ativo"];

type AggType = "sum" | "avg" | "count";
const NUMERIC_KEYS: ColKey[] = ["quantidade", "preco_unitario", "valor_total", "qtd_medida", "valor_medido", "qtd_faturada", "valor_faturado"];
const DEDUP_KEYS = new Set<ColKey>(["qtd_medida", "valor_medido", "qtd_faturada", "valor_faturado"]);
const DEFAULT_AGG: Record<string, AggType> = {
  quantidade: "sum", valor_total: "sum", qtd_medida: "sum", valor_medido: "sum",
  qtd_faturada: "sum", valor_faturado: "sum", preco_unitario: "avg",
};
const AGG_LABEL: Record<AggType, string> = { sum: "Soma", avg: "Média", count: "Contagem" };

interface Row {
  projeto: string;
  site_id: string;
  item_id: string;
  site_codigo: string;
  site_nome: string;
  municipio: string;
  uf: string;
  data: string;
  mes: string;
  clima: string;
  status_ativo: string;
  item_codigo: string;
  item_descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  qtd_medida: number;
  valor_medido: number;
  qtd_faturada: number;
  valor_faturado: number;
  observacoes: string;
}

const fmtCurrency = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
const fmtDecimal = (v: any) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtDate = (v: string) => {
  if (!v) return "";
  const [y, m, d] = String(v).split("-");
  return `${d}/${m}/${y}`;
};

export default function RelatorioAvancado({ projetoId, selectedSiteIds, dataInicio, dataFim }: Props) {
  const { empresaId } = useAuth();
  const [visibleColumns, setVisibleColumns] = usePersistedState<ColKey[]>("relatorio_avancado_columns", DEFAULT_VISIBLE);
  const [groupBy, setGroupBy] = usePersistedState<ColKey[]>("relatorio_avancado_groupby", []);
  const [rowDims, setRowDims] = usePersistedState<ColKey[]>("relatorio_avancado_rowdims", []);
  const [showDetails, setShowDetails] = usePersistedState<boolean>("relatorio_avancado_showdetails", false);
  const [aggregations, setAggregations] = usePersistedState<Record<string, AggType>>("relatorio_avancado_aggs", DEFAULT_AGG);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleRowDim = (key: ColKey) =>
    setRowDims(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["relatorio_avancado_v2", empresaId, projetoId, selectedSiteIds, dataInicio, dataFim],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Row[]> => {
      // 1) Diários + produção
      let q = supabase
        .from("diarios_obra")
        .select("id, data, observacoes, clima, status_ativo, municipio, uf, site_id, site:sites!inner(id, codigo, nome, projeto_id, projeto:projetos!inner(id, codigo, empresa_id))");
      if (empresaId) q = q.eq("site.projeto.empresa_id", empresaId);
      if (projetoId) q = q.eq("site.projeto_id", projetoId);
      if (selectedSiteIds.length > 0) q = q.in("site_id", selectedSiteIds);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);

      const diarios = await fetchAllPages<any>(q);
      if (!diarios.length) return [];

      const ids = diarios.map((d: any) => d.id);
      const prods = await fetchAllPages<any>(
        supabase
          .from("diario_producao")
          .select("diario_id, item_lpu_id, quantidade, valor_total, preco_unitario_congelado, item_lpu:itens_lpu(id, codigo, descricao, unidade, preco_unitario)")
          .in("diario_id", ids)
      );

      // 2) Medição + Faturamento por (site, item)
      const siteIds = Array.from(new Set(diarios.map((d: any) => d.site_id).filter(Boolean)));
      const medQ = supabase
        .from("lancamentos_medicao")
        .select("site_id, item_lpu_id, quantidade, item_lpu:itens_lpu(preco_unitario)")
        .in("site_id", siteIds);
      if (dataInicio) medQ.gte("data_medicao", dataInicio);
      if (dataFim) medQ.lte("data_medicao", dataFim);

      const fatQ = supabase
        .from("lancamentos_faturamento")
        .select("site_id, item_lpu_id, quantidade, valor_faturado, item_lpu:itens_lpu(preco_unitario)")
        .in("site_id", siteIds);
      if (dataInicio) fatQ.gte("data_faturamento", dataInicio);
      if (dataFim) fatQ.lte("data_faturamento", dataFim);

      const [meds, fats] = await Promise.all([fetchAllPages<any>(medQ), fetchAllPages<any>(fatQ)]);

      const medMap = new Map<string, { qtd: number; valor: number }>();
      meds.forEach((m: any) => {
        const k = `${m.site_id}|${m.item_lpu_id}`;
        const cur = medMap.get(k) || { qtd: 0, valor: 0 };
        const qtd = Number(m.quantidade) || 0;
        cur.qtd += qtd;
        cur.valor += qtd * (Number(m.item_lpu?.preco_unitario) || 0);
        medMap.set(k, cur);
      });
      const fatMap = new Map<string, { qtd: number; valor: number }>();
      fats.forEach((f: any) => {
        const k = `${f.site_id}|${f.item_lpu_id}`;
        const cur = fatMap.get(k) || { qtd: 0, valor: 0 };
        const qtd = Number(f.quantidade) || 0;
        cur.qtd += qtd;
        cur.valor += Number(f.valor_faturado) || qtd * (Number(f.item_lpu?.preco_unitario) || 0);
        fatMap.set(k, cur);
      });

      const dMap = new Map(diarios.map((d: any) => [d.id, d]));
      return (prods || []).map((p: any) => {
        const d: any = dMap.get(p.diario_id) || {};
        const preco = Number(p.preco_unitario_congelado) || Number(p.item_lpu?.preco_unitario) || 0;
        const key = `${d.site_id}|${p.item_lpu_id}`;
        const med = medMap.get(key) || { qtd: 0, valor: 0 };
        const fat = fatMap.get(key) || { qtd: 0, valor: 0 };
        const dataStr = d.data || "";
        return {
          projeto: d.site?.projeto?.codigo || "",
          site_id: d.site_id || "",
          item_id: p.item_lpu_id || "",
          site_codigo: d.site?.codigo || "",
          site_nome: d.site?.nome || "",
          municipio: d.municipio || "",
          uf: d.uf || "",
          data: dataStr,
          mes: dataStr ? dataStr.substring(0, 7) : "",
          clima: d.clima || "",
          status_ativo: d.status_ativo || "",
          item_codigo: p.item_lpu?.codigo || "",
          item_descricao: p.item_lpu?.descricao || "",
          unidade: p.item_lpu?.unidade || "",
          quantidade: Number(p.quantidade) || 0,
          preco_unitario: preco,
          valor_total: Number(p.valor_total) || 0,
          qtd_medida: med.qtd,
          valor_medido: med.valor,
          qtd_faturada: fat.qtd,
          valor_faturado: fat.valor,
          observacoes: d.observacoes || "",
        } as Row;
      });
    },
  });

  const activeColumns = useMemo(() => ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)), [visibleColumns]);
  const activeKeys = useMemo(() => activeColumns.map(c => c.key), [activeColumns]);

  const getColValue = (row: Row, col: ColKey): string => {
    const v = row[col as keyof Row];
    if (typeof v === "number") return String(v);
    return (v as string) ?? "";
  };

  const filters = useTableFilters<Row, ColKey>(rows, activeKeys, getColValue, "relatorio_avancado_filters");

  const toggleColumn = (key: ColKey) =>
    setVisibleColumns(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  const toggleGroupBy = (key: ColKey) =>
    setGroupBy(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const formatCell = (col: ColKey, value: any, agg?: AggType) => {
    const meta = ALL_COLUMNS.find(c => c.key === col);
    if (agg === "count") return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
    if (meta?.currency) return fmtCurrency(value);
    if (meta?.decimal) return fmtDecimal(value);
    if (col === "data") return fmtDate(value);
    if (meta?.numeric) return fmtDecimal(value);
    return value ?? "";
  };

  // Group tree for pivot display
  interface GroupNode {
    key: string;
    label: string;
    depth: number;
    rows: Row[];
    children?: GroupNode[];
    aggregates: Partial<Record<ColKey, number>>;
  }

  const aggregateRows = (groupRows: Row[]): Partial<Record<ColKey, number>> => {
    const out: Partial<Record<ColKey, number>> = {};
    // dedup rows for medição/faturamento keys (avoid double count on per-day duplication)
    const seen = new Set<string>();
    const dedup: Row[] = [];
    groupRows.forEach(r => {
      const k = `${r.site_id}|${r.item_id}`;
      if (seen.has(k)) return;
      seen.add(k);
      dedup.push(r);
    });
    NUMERIC_KEYS.forEach(col => {
      const type: AggType = aggregations[col] || DEFAULT_AGG[col] || "sum";
      const src = DEDUP_KEYS.has(col) ? dedup : groupRows;
      if (type === "count") {
        out[col] = src.filter(r => Number(r[col as keyof Row]) > 0).length;
      } else if (type === "avg") {
        const vals = src.map(r => Number(r[col as keyof Row]) || 0).filter(v => v !== 0);
        out[col] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      } else {
        out[col] = src.reduce((a, r) => a + (Number(r[col as keyof Row]) || 0), 0);
      }
    });
    return out;
  };

  const groupTree = useMemo<GroupNode[] | null>(() => {
    if (groupBy.length === 0) return null;
    const build = (items: Row[], depth: number, path: string): GroupNode[] => {
      const key = groupBy[depth];
      const map = new Map<string, Row[]>();
      items.forEach(r => {
        const v = String(r[key as keyof Row] ?? "");
        if (!map.has(v)) map.set(v, []);
        map.get(v)!.push(r);
      });
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
        .map(([label, grpRows]) => {
          const nodePath = `${path}/${label}`;
          return {
            key: nodePath,
            label: label || "(vazio)",
            depth,
            rows: grpRows,
            children: depth + 1 < groupBy.length ? build(grpRows, depth + 1, nodePath) : undefined,
            aggregates: aggregateRows(grpRows),
          };
        });
    };
    return build(filters.processedItems, 0, "");
  }, [filters.processedItems, groupBy, aggregations]);

  // Pivot rows: dedupe by chosen dimensions and aggregate numerics (used when not grouping)
  const pivotRows = useMemo<Row[] | null>(() => {
    if (groupBy.length > 0 || rowDims.length === 0) return null;
    const map = new Map<string, Row[]>();
    filters.processedItems.forEach(r => {
      const k = rowDims.map(d => String(r[d as keyof Row] ?? "")).join("||");
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    const out: Row[] = [];
    map.forEach((grp, _key) => {
      const agg = aggregateRows(grp);
      const base: any = {};
      // keep dimension values
      rowDims.forEach(d => { base[d] = grp[0][d as keyof Row]; });
      // blank other non-numeric columns
      ALL_COLUMNS.forEach(c => {
        if (rowDims.includes(c.key)) return;
        if (c.numeric) base[c.key] = agg[c.key] ?? 0;
        else base[c.key] = "";
      });
      base.site_id = grp[0].site_id;
      base.item_id = grp[0].item_id;
      out.push(base as Row);
    });
    return out.sort((a, b) =>
      rowDims.map(d => String(a[d as keyof Row] ?? "").localeCompare(String(b[d as keyof Row] ?? ""), "pt-BR", { numeric: true }))
        .find(v => v !== 0) ?? 0
    );
  }, [filters.processedItems, rowDims, groupBy, aggregations]);


  const toggleExpand = (k: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const expandAll = () => {
    if (!groupTree) return;
    const all = new Set<string>();
    const walk = (nodes: GroupNode[]) => nodes.forEach(n => { all.add(n.key); n.children && walk(n.children); });
    walk(groupTree);
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = [];

    // Header row: optional group level columns + active columns (with agg label when grouped)
    const header: string[] = [];
    if (groupBy.length > 0) {
      groupBy.forEach((g, i) => {
        const meta = ALL_COLUMNS.find(c => c.key === g);
        header.push(`Nível ${i + 1} - ${meta?.label ?? g}`);
      });
    }
    activeColumns.forEach(c => {
      const isAgg = c.numeric && groupBy.length > 0;
      const aggT = (aggregations[c.key] || DEFAULT_AGG[c.key] || "sum") as AggType;
      header.push(isAgg ? `${c.label} (${AGG_LABEL[aggT]})` : c.label);
    });
    aoa.push(header);

    const padLeft = (vals: (string | number)[]): (string | number)[] => {
      const pad: (string | number)[] = new Array(groupBy.length).fill("");
      return [...pad, ...vals];
    };

    const detailRow = (r: Row): (string | number)[] => {
      const vals = activeColumns.map(c => {
        const v: any = r[c.key as keyof Row];
        if (c.numeric) return Number(v) || 0;
        if (c.key === "data") return fmtDate(v);
        return (v as any) ?? "";
      });
      return padLeft(vals);
    };

    const subtotalRow = (node: GroupNode): (string | number)[] => {
      const row: (string | number)[] = [];
      for (let i = 0; i < groupBy.length; i++) {
        row.push(i < node.depth ? "" : i === node.depth ? `${node.label}` : "");
      }
      activeColumns.forEach(c => {
        if (c.numeric) {
          const v = node.aggregates[c.key];
          row.push(v != null ? Number(v) : "");
        } else if (groupBy[node.depth] === c.key) {
          row.push(node.label);
        } else {
          row.push("");
        }
      });
      return row;
    };

    const walk = (nodes: GroupNode[]) => {
      nodes.forEach(node => {
        aoa.push(subtotalRow(node));
        if (node.children?.length) {
          walk(node.children);
        } else if (showDetails) {
          node.rows.forEach(r => aoa.push(detailRow(r)));
        }
      });
    };

    if (groupTree && groupBy.length > 0) {
      walk(groupTree);
      // Grand total
      const grand = aggregateRows(filters.processedItems);
      const totalRow: (string | number)[] = [];
      for (let i = 0; i < groupBy.length; i++) totalRow.push(i === 0 ? "TOTAL GERAL" : "");
      activeColumns.forEach(c => {
        if (c.numeric) {
          const v = grand[c.key];
          totalRow.push(v != null ? Number(v) : "");
        } else {
          totalRow.push("");
        }
      });
      aoa.push(totalRow);
    } else if (pivotRows) {
      pivotRows.forEach(r => aoa.push(detailRow(r)));
      const grand = aggregateRows(filters.processedItems);
      const totalRow: (string | number)[] = activeColumns.map(c =>
        c.numeric ? Number(grand[c.key] ?? 0) : ""
      );
      if (totalRow.length) totalRow[0] = "TOTAL GERAL";
      aoa.push(totalRow);
    } else {
      filters.processedItems.forEach(r => aoa.push(detailRow(r)));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Avançado");
    XLSX.writeFile(wb, `relatorio_avancado_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const groupedColumns = useMemo(() => {
    const map = new Map<string, typeof ALL_COLUMNS>();
    ALL_COLUMNS.forEach(c => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return Array.from(map.entries());
  }, []);

  const renderGroupRows = (nodes: GroupNode[]): JSX.Element[] => {
    const out: JSX.Element[] = [];
    nodes.forEach(node => {
      const isOpen = expanded.has(node.key);
      const hasChildren = !!node.children?.length;
      out.push(
        <TableRow key={node.key} className="bg-muted/40 font-medium hover:bg-muted/60">
          {activeColumns.map((c, idx) => {
            if (idx === 0) {
              return (
                <TableCell key={c.key} style={{ paddingLeft: `${node.depth * 20 + 12}px` }}>
                  <button
                    onClick={() => toggleExpand(node.key)}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{node.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">({node.rows.length})</span>
                  </button>
                </TableCell>
              );
            }
            const aggVal = node.aggregates[c.key];
            if (aggVal !== undefined) {
              return (
                <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : ""}>
                  {formatCell(c.key, aggVal, (aggregations[c.key] || DEFAULT_AGG[c.key] || "sum") as AggType)}
                </TableCell>
              );
            }
            return <TableCell key={c.key} />;
          })}
        </TableRow>
      );
      if (isOpen) {
        if (hasChildren) {
          out.push(...renderGroupRows(node.children!));
        } else if (showDetails) {
          node.rows.forEach((r, i) => {
            out.push(
              <TableRow key={`${node.key}-r${i}`}>
                {activeColumns.map((c, idx) => (
                  <TableCell
                    key={c.key}
                    style={idx === 0 ? { paddingLeft: `${(node.depth + 1) * 20 + 12}px` } : undefined}
                    className={`${c.numeric ? "text-right tabular-nums" : ""} ${c.key === "observacoes" ? "max-w-md whitespace-pre-wrap text-xs text-muted-foreground" : ""}`}
                  >
                    {formatCell(c.key, r[c.key as keyof Row])}
                  </TableCell>
                ))}
              </TableRow>
            );
          });
        }
      }
    });
    return out;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <CardTitle>Relatório Avançado</CardTitle>
            <CardDescription>
              Combine dados de diário, medição e faturamento. Configure colunas e agrupamentos como em uma tabela dinâmica.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Rows3 className="h-4 w-4 mr-2" />
                  Agrupar por ({groupBy.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Agrupamentos</span>
                  <button onClick={() => setGroupBy([])} className="text-xs text-primary hover:underline">Limpar</button>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-2">
                    {GROUPABLE.map(k => {
                      const c = ALL_COLUMNS.find(x => x.key === k)!;
                      const idx = groupBy.indexOf(k);
                      return (
                        <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-sm">
                          <Checkbox checked={idx >= 0} onCheckedChange={() => toggleGroupBy(k)} />
                          <span className="flex-1">{c.label}</span>
                          {idx >= 0 && <span className="text-xs text-muted-foreground">nível {idx + 1}</span>}
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
                {groupBy.length > 0 && (
                  <>
                    <label className="px-3 py-2 border-t flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={showDetails} onCheckedChange={v => setShowDetails(!!v)} />
                      <span>Mostrar linhas de detalhe</span>
                    </label>
                    <div className="p-2 border-t flex gap-2">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={expandAll}>Expandir tudo</Button>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={collapseAll}>Recolher tudo</Button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sigma className="h-4 w-4 mr-2" />
                  Valores
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Agregação por coluna</span>
                  <button onClick={() => setAggregations(DEFAULT_AGG)} className="text-xs text-primary hover:underline">Padrão</button>
                </div>
                <ScrollArea className="h-72">
                  <div className="p-2 space-y-1">
                    {NUMERIC_KEYS.map(k => {
                      const c = ALL_COLUMNS.find(x => x.key === k)!;
                      const cur = (aggregations[k] || DEFAULT_AGG[k] || "sum") as AggType;
                      return (
                        <div key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className="flex-1 truncate">{c.label}</span>
                          <Select value={cur} onValueChange={(v) => setAggregations({ ...aggregations, [k]: v as AggType })}>
                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sum">{AGG_LABEL.sum}</SelectItem>
                              <SelectItem value="avg">{AGG_LABEL.avg}</SelectItem>
                              <SelectItem value="count">{AGG_LABEL.count}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="p-2 border-t text-xs text-muted-foreground">
                  Aplicado nas linhas agrupadas. "Contagem" considera valores &gt; 0.
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Colunas ({visibleColumns.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Campos disponíveis</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.key))} className="text-primary hover:underline">Todos</button>
                    <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE)} className="text-primary hover:underline">Padrão</button>
                  </div>
                </div>
                <ScrollArea className="h-80">
                  <div className="p-2 space-y-3">
                    {groupedColumns.map(([group, cols]) => (
                      <div key={group}>
                        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase">{group}</div>
                        {cols.map(c => (
                          <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-sm">
                            <Checkbox checked={visibleColumns.includes(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                            <span>{c.label}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filters.processedItems.length}>
              <FileDown className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
        {filters.hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={filters.clearAllFilters}>Limpar filtros</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum dado encontrado para os filtros selecionados</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeColumns.map(c => (
                      <TableHead key={c.key} className={c.numeric ? "text-right" : ""}>
                        <ColumnHeader
                          label={c.numeric && groupBy.length > 0 ? `${c.label} (${AGG_LABEL[(aggregations[c.key] || DEFAULT_AGG[c.key] || "sum") as AggType]})` : c.label}
                          sortDir={filters.sortColumn === c.key ? filters.sortDir : null}
                          onSort={() => filters.handleSort(c.key)}
                          searchText={filters.searchTexts[c.key] || ""}
                          onSearchChange={v => filters.setSearchText(c.key, v)}
                          uniqueValues={filters.uniqueValues[c.key] || []}
                          selectedValues={filters.selectedFilters[c.key] || new Set()}
                          onToggleValue={v => filters.toggleValue(c.key, v)}
                          onSelectAll={() => filters.selectAll(c.key, filters.uniqueValues[c.key] || [])}
                          onClearAll={() => filters.clearAll(c.key)}
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupTree
                    ? renderGroupRows(groupTree)
                    : filters.paginatedItems.map((r, i) => (
                        <TableRow key={i}>
                          {activeColumns.map(c => (
                            <TableCell
                              key={c.key}
                              className={`${c.numeric ? "text-right tabular-nums" : ""} ${c.key === "observacoes" ? "max-w-md whitespace-pre-wrap text-xs text-muted-foreground" : ""}`}
                            >
                              {formatCell(c.key, r[c.key as keyof Row])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
            {!groupTree && (
              <TablePagination
                currentPage={filters.currentPage}
                totalPages={filters.totalPages}
                itemsPerPage={filters.itemsPerPage}
                totalItems={filters.processedItems.length}
                onPageChange={filters.setCurrentPage}
                onItemsPerPageChange={filters.setItemsPerPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
