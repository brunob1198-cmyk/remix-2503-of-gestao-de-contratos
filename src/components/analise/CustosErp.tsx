import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { TablePagination } from "@/components/medicoes/TablePagination";

interface CustosErpProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

// Categorias padrão usadas na Análise de Custos
const CATEGORIAS_PADRAO = [
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Transporte",
  "Indiretos",
  "Financeiros",
];

type ColKey = "competencia" | "descricao" | "mapeamento" | "centro_custo" | "valor" | "status" | "categoria";

const COL_LABELS: Record<ColKey, string> = {
  competencia: "Competência",
  descricao: "Descrição ERP",
  mapeamento: "Mapeamento Original ERP",
  centro_custo: "Centro Custo ERP",
  valor: "Valor R$",
  status: "Status",
  categoria: "Categoria IA/Engenharia",
};

type SortDir = "asc" | "desc" | null;

function getColValue(item: any, col: ColKey): string {
  if (col === "competencia") return item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-";
  if (col === "descricao") return item.descricao || "";
  if (col === "mapeamento") return item.categoria_erp || "";
  if (col === "centro_custo") return item.centro_custo || "";
  if (col === "valor") return item.valor?.toString() || "0";
  if (col === "status") return item.status_erp?.toUpperCase() || "";
  if (col === "categoria") return item.categoria_interna || "";
  return "";
}

interface ColumnHeaderFilterProps {
  label: string;
  sortDir: SortDir;
  onSort: () => void;
  searchText: string;
  onSearchChange: (v: string) => void;
  uniqueValues: string[];
  selectedValues: Set<string>;
  onToggleValue: (v: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ColumnHeaderFilter({ label, sortDir, onSort, searchText, onSearchChange, uniqueValues, selectedValues, onToggleValue, onSelectAll, onClearAll }: ColumnHeaderFilterProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="flex items-center gap-1">
      <button onClick={onSort} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium text-xs">
        {label}
        <SortIcon className="h-3 w-3" />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`p-0.5 rounded hover:bg-accent transition-colors ${isFiltered ? "text-primary" : "text-muted-foreground"}`}>
            <Filter className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <Input placeholder={`Pesquisar ${label.toLowerCase()}...`} value={searchText} onChange={(e) => onSearchChange(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2 text-xs">
            <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
            <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {uniqueValues.filter(v => v.toLowerCase().includes(searchText.toLowerCase())).map(v => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                <Checkbox checked={selectedValues.has(v)} onCheckedChange={() => onToggleValue(v)} className="h-3.5 w-3.5" />
                <span className="truncate">{v || "(vazio)"}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CustosErp({ projetoIds, periodoInicio, periodoFim }: CustosErpProps) {
  const { custosErp, loadCustos, updateCategoria } = useAnaliseCustosMulti(projetoIds, periodoInicio, periodoFim);

  const allCols: ColKey[] = ["competencia", "descricao", "mapeamento", "centro_custo", "valor", "status", "categoria"];

  // Persist filters to localStorage
  const STORAGE_KEY = "custos_erp_filters";

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  const persisted = useMemo(() => loadPersisted(), []);

  const [sortCol, setSortCol] = useState<ColKey | null>(persisted?.sortCol ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(persisted?.sortDir ?? null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(persisted?.itemsPerPage ?? 20);
  const [searchTexts, setSearchTexts] = useState<Record<ColKey, string>>(() => {
    if (persisted?.searchTexts) return persisted.searchTexts;
    const init: any = {};
    allCols.forEach(c => init[c] = "");
    return init;
  });
  const [selectedFilters, setSelectedFilters] = useState<Record<ColKey, Set<string>>>(() => {
    if (persisted?.selectedFilters) {
      const restored: any = {};
      allCols.forEach(c => restored[c] = new Set(persisted.selectedFilters[c] || []));
      return restored;
    }
    const init: any = {};
    allCols.forEach(c => init[c] = new Set());
    return init;
  });

  // Save to localStorage on change
  useEffect(() => {
    try {
      const serializable: any = {
        sortCol, sortDir, itemsPerPage, searchTexts,
        selectedFilters: Object.fromEntries(allCols.map(c => [c, Array.from(selectedFilters[c])])),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
  }, [sortCol, sortDir, itemsPerPage, searchTexts, selectedFilters]);

  function handleSort(col: ColKey) {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : prev === "desc" ? null : "asc");
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function setSearchText(col: ColKey, v: string) {
    setSearchTexts(prev => ({ ...prev, [col]: v }));
  }
  function toggleValue(col: ColKey, v: string) {
    setSelectedFilters(prev => {
      const next = new Set(prev[col]);
      next.has(v) ? next.delete(v) : next.add(v);
      return { ...prev, [col]: next };
    });
  }
  function selectAll(col: ColKey, values: string[]) {
    setSelectedFilters(prev => ({ ...prev, [col]: new Set(values) }));
  }
  function clearAll(col: ColKey) {
    setSelectedFilters(prev => ({ ...prev, [col]: new Set() }));
  }

  const uniqueValues = useMemo(() => {
    const result: Record<ColKey, string[]> = {} as any;
    allCols.forEach(col => {
      result[col] = Array.from(new Set(custosErp.map(item => getColValue(item, col)))).sort();
    });
    return result;
  }, [custosErp]);

  const filteredItems = useMemo(() => {
    let items = [...custosErp];
    for (const col of allCols) {
      const search = searchTexts[col].toLowerCase();
      const selected = selectedFilters[col];
      if (search) items = items.filter(item => getColValue(item, col).toLowerCase().includes(search));
      if (selected.size > 0) items = items.filter(item => selected.has(getColValue(item, col)));
    }
    if (sortCol && sortDir) {
      items.sort((a, b) => {
        let va = getColValue(a, sortCol);
        let vb = getColValue(b, sortCol);
        if (sortCol === "valor") {
          return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
        }
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return items;
  }, [custosErp, searchTexts, selectedFilters, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  // Reset page when filters change
  const filterKey = JSON.stringify({ searchTexts, selectedFilters: Object.fromEntries(allCols.map(c => [c, Array.from(selectedFilters[c])])) });
  useMemo(() => { setCurrentPage(1); }, [filterKey]);

  const hasActiveFilters = allCols.some(c => searchTexts[c] !== "" || selectedFilters[c].size > 0);

  function clearAllFilters() {
    const emptySearch: any = {};
    const emptyFilter: any = {};
    allCols.forEach(c => { emptySearch[c] = ""; emptyFilter[c] = new Set(); });
    setSearchTexts(emptySearch);
    setSelectedFilters(emptyFilter);
    setSortCol(null);
    setSortDir(null);
    setCurrentPage(1);
  }

  function handleExportExcel() {
    const rows = filteredItems.map(item => ({
      [COL_LABELS.competencia]: item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-",
      [COL_LABELS.descricao]: item.descricao,
      [COL_LABELS.mapeamento]: item.categoria_erp,
      [COL_LABELS.centro_custo]: item.centro_custo || "",
      [COL_LABELS.valor]: item.valor,
      [COL_LABELS.status]: item.status_erp?.toUpperCase() || "",
      [COL_LABELS.categoria]: item.categoria_interna,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria ERP");
    XLSX.writeFile(wb, `auditoria_erp_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auditoria de Despesas - Conta Azul</CardTitle>
            <CardDescription>
              Visualize e re-categorize as despesas vinculadas a esta Obra e Site (Centro de Custo). A Inteligência Artificial já tentou categorizar os itens iniciais.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredItems.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadCustos ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : custosErp.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-md">
            Nenhuma despesa ou pagamento ERP encontrado para este mês ou site.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {allCols.map(col => (
                    <th key={col} className={`py-2 px-3 ${col === "valor" ? "text-right" : col === "status" || col === "categoria" ? "text-center" : "text-left"} whitespace-nowrap`}>
                      <ColumnHeaderFilter
                        label={COL_LABELS[col]}
                        sortDir={sortCol === col ? sortDir : null}
                        onSort={() => handleSort(col)}
                        searchText={searchTexts[col]}
                        onSearchChange={(v) => setSearchText(col, v)}
                        uniqueValues={uniqueValues[col]}
                        selectedValues={selectedFilters[col]}
                        onToggleValue={(v) => toggleValue(col, v)}
                        onSelectAll={() => selectAll(col, uniqueValues[col])}
                        onClearAll={() => clearAll(col)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={allCols.length} className="text-center py-6 text-muted-foreground">Nenhum resultado com os filtros aplicados</td></tr>
                ) : paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="py-2 px-3 text-muted-foreground">
                       {item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-"}
                    </td>
                    <td className="py-2 px-3 font-medium">{item.descricao}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.categoria_erp}</td>
                    <td className="py-2 px-3 text-xs">
                       {item.centro_custo ? (
                         <Badge variant="outline" className="bg-primary/5">{item.centro_custo}</Badge>
                       ) : (
                         <span className="text-muted-foreground italic">Sem vínculo</span>
                       )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.valor)}</td>
                    <td className="py-2 px-3 text-center">
                       <Badge variant={item.status_erp === "pago" ? "secondary" : "outline"} className={item.status_erp === "pago" ? "bg-emerald-500/10 text-emerald-600" : ""}>
                         {item.status_erp?.toUpperCase()}
                       </Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                       <Select 
                         value={item.categoria_interna} 
                         onValueChange={(val) => updateCategoria.mutate({ erpId: item.erp_id, newCategoria: val })}
                       >
                         <SelectTrigger className="h-7 text-xs">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                            {CATEGORIAS_PADRAO.map(cat => (
                              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                            ))}
                         </SelectContent>
                       </Select>
                    </td>
                  </tr>
                ))}
                {filteredItems.length > 0 && (
                  <tr className="bg-muted/50 font-semibold border-t-2">
                    <td colSpan={4} className="py-2 px-3 text-right">Subtotal (todos os {filteredItems.length} registros)</td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrency(filteredItems.reduce((acc, item) => acc + Number(item.valor), 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
              totalItems={filteredItems.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
