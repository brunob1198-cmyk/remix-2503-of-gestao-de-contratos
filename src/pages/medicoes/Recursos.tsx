import { useState, useMemo, useRef } from "react";
import { useRecursos, TipoRecurso, UnidadeRecurso, RecursoCusto, RecursoAlocacao } from "@/hooks/useRecursos";
import { useSites } from "@/hooks/useSites";
import { useProjetos } from "@/hooks/useProjetos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Pencil, History, HardHat, Wrench, Truck, ArrowUp, ArrowDown, ArrowUpDown, Filter, X, Upload, Trash2, MapPin, Link2, Download } from "lucide-react";
import { RecursosImporter } from "@/components/medicoes/RecursosImporter";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays, isWithinInterval, isBefore, isAfter, parseISO, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

type SortDir = "asc" | "desc" | null;
const MONTH_WIDTH = 120;

const tipoConfig = {
  pessoa: { label: "👷 Pessoas", icon: HardHat },
  equipamento: { label: "🚜 Equipamentos", icon: Wrench },
  veiculo: { label: "🚛 Veículos", icon: Truck },
} as const;

const statusOptionsPessoa = [
  { value: "alocado", label: "Alocado", color: "bg-blue-100 text-blue-800" },
  { value: "livre", label: "Livre", color: "bg-emerald-100 text-emerald-800" },
  { value: "folga", label: "Folga", color: "bg-amber-100 text-amber-800" },
  { value: "ferias", label: "Férias", color: "bg-purple-100 text-purple-800" },
];

const statusOptionsEquip = [
  { value: "alocado", label: "Alocado", color: "bg-blue-100 text-blue-800" },
  { value: "livre", label: "Livre", color: "bg-emerald-100 text-emerald-800" },
  { value: "manutencao", label: "Manutenção", color: "bg-red-100 text-red-800" },
];

function getStatusOptions(tipo: TipoRecurso) {
  return tipo === "pessoa" ? statusOptionsPessoa : statusOptionsEquip;
}

function getStatusBadge(status: string, tipo: TipoRecurso) {
  const options = getStatusOptions(tipo);
  const opt = options.find(o => o.value === status);
  if (!opt) return <Badge variant="secondary">{status}</Badge>;
  return <Badge className={`${opt.color} border-0`}>{opt.label}</Badge>;
}

interface ColumnHeaderProps {
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

function ColumnHeader({ label, sortDir, onSort, searchText, onSearchChange, uniqueValues, selectedValues, onToggleValue, onSelectAll, onClearAll }: ColumnHeaderProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="flex items-center gap-1">
      <button onClick={onSort} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium">
        {label}
        <SortIcon className="h-3.5 w-3.5" />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`p-0.5 rounded hover:bg-accent transition-colors ${isFiltered ? "text-primary" : "text-muted-foreground"}`}>
            <Filter className="h-3.5 w-3.5" />
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
                <span className="truncate">{v}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type ColKey = "nome" | "cargo" | "placa" | "custo" | "status" | "alocacao" | "periodo";
const columnLabels: Record<ColKey, string> = { nome: "Nome", cargo: "Cargo", placa: "Placa", custo: "Custo Atual", status: "Status", alocacao: "Alocação", periodo: "Período" };

// Gantt bar colors by type
const ganttColors: Record<TipoRecurso, string> = {
  pessoa: "hsl(var(--primary))",
  equipamento: "hsl(215, 70%, 55%)",
  veiculo: "hsl(150, 60%, 45%)",
};

function getGanttMonths(alocacoes: RecursoAlocacao[]): Date[] {
  if (alocacoes.length === 0) {
    const now = new Date();
    const months: Date[] = [];
    for (let i = -1; i <= 4; i++) months.push(startOfMonth(addMonths(now, i)));
    return months;
  }
  let minDate = new Date();
  let maxDate = new Date();
  alocacoes.forEach(a => {
    const start = parseISO(a.data_inicio);
    const end = a.data_fim ? parseISO(a.data_fim) : addMonths(new Date(), 3);
    if (isBefore(start, minDate)) minDate = start;
    if (isAfter(end, maxDate)) maxDate = end;
  });
  minDate = startOfMonth(addMonths(minDate, -1));
  maxDate = startOfMonth(addMonths(maxDate, 2));
  const months: Date[] = [];
  let cur = minDate;
  while (isBefore(cur, maxDate) || cur.getTime() === maxDate.getTime()) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }
  return months;
}

const DAY_WIDTH = 24;

export default function RecursosPage() {
  const { recursos, alocacoes, isLoading, createRecurso, updateCusto, updateRecurso, deleteRecurso, updateStatus, alocarRecurso, liberarRecurso, getCustoAtual, getHistorico, getAlocacaoAtiva } = useRecursos();
  const { sites } = useSites();
  const { projetos } = useProjetos();
  const [showNew, setShowNew] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editRecurso, setEditRecurso] = useState<string | null>(null);
  const [histRecurso, setHistRecurso] = useState<string | null>(null);
  const [alocarRecursoId, setAlocarRecursoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Status date dialog (férias/folga)
  const [statusDateDialog, setStatusDateDialog] = useState<{ recursoId: string; status: string } | null>(null);
  const [statusDataInicio, setStatusDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [statusDataFim, setStatusDataFim] = useState("");

  // New resource form
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState<TipoRecurso>("pessoa");
  const [newUnidade, setNewUnidade] = useState<UnidadeRecurso>("hora");
  const [newCusto, setNewCusto] = useState("");
  const [newCargo, setNewCargo] = useState("");
  const [newPlaca, setNewPlaca] = useState("");
  const [newDataInicio, setNewDataInicio] = useState(new Date().toISOString().split("T")[0]);

  // Edit form
  const [editNome, setEditNome] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editPlaca, setEditPlaca] = useState("");
  const [editCusto, setEditCusto] = useState("");
  const [editMotivo, setEditMotivo] = useState("");
  const [editDataInicio, setEditDataInicio] = useState(new Date().toISOString().split("T")[0]);

  // Allocation form
  const [alocProjetoId, setAlocProjetoId] = useState("");
  const [alocSiteId, setAlocSiteId] = useState("");
  const [alocDataInicio, setAlocDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [alocDataFim, setAlocDataFim] = useState("");

  // Pagination per type
  const [currentPages, setCurrentPages] = useState<Record<TipoRecurso, number>>({ pessoa: 1, equipamento: 1, veiculo: 1 });
  const [itemsPerPages, setItemsPerPages] = useState<Record<TipoRecurso, number>>({ pessoa: 10, equipamento: 10, veiculo: 10 });

  // Filter/sort state per group
  const [sortColumns, setSortColumns] = useState<Record<TipoRecurso, ColKey | null>>({ pessoa: null, equipamento: null, veiculo: null });
  const [sortDirs, setSortDirs] = useState<Record<TipoRecurso, SortDir>>({ pessoa: null, equipamento: null, veiculo: null });
  const [searchTexts, setSearchTexts] = useState<Record<TipoRecurso, Record<ColKey, string>>>({
    pessoa: { nome: "", cargo: "", placa: "", custo: "", status: "", alocacao: "", periodo: "" },
    equipamento: { nome: "", cargo: "", placa: "", custo: "", status: "", alocacao: "", periodo: "" },
    veiculo: { nome: "", cargo: "", placa: "", custo: "", status: "", alocacao: "", periodo: "" },
  });
  const [selectedFilters, setSelectedFilters] = useState<Record<TipoRecurso, Record<ColKey, Set<string>>>>({
    pessoa: { nome: new Set(), cargo: new Set(), placa: new Set(), custo: new Set(), status: new Set(), alocacao: new Set(), periodo: new Set() },
    equipamento: { nome: new Set(), cargo: new Set(), placa: new Set(), custo: new Set(), status: new Set(), alocacao: new Set(), periodo: new Set() },
    veiculo: { nome: new Set(), cargo: new Set(), placa: new Set(), custo: new Set(), status: new Set(), alocacao: new Set(), periodo: new Set() },
  });

  function getAlocacaoLabel(recursoId: string): string {
    const aloc = getAlocacaoAtiva(recursoId);
    if (!aloc) return "—";
    const site = sites.find(s => s.id === aloc.site_id);
    const projeto = projetos.find(p => p.id === aloc.projeto_id);
    return `${projeto?.codigo || "?"} / ${site?.codigo || "?"}`;
  }

  function getPeriodoLabel(recursoId: string): string {
    const aloc = getAlocacaoAtiva(recursoId);
    if (!aloc) return "—";
    const inicio = new Date(aloc.data_inicio).toLocaleDateString("pt-BR");
    const fim = aloc.data_fim ? new Date(aloc.data_fim).toLocaleDateString("pt-BR") : "Atual";
    return `${inicio} — ${fim}`;
  }

  function getColValue(r: any, col: ColKey): string {
    if (col === "nome") return r.nome;
    if (col === "cargo") return r.cargo || "—";
    if (col === "placa") return r.placa || "—";
    if (col === "custo") {
      const c = getCustoAtual(r.id);
      return c ? `R$ ${c.custo_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/${r.unidade === "hora" ? "h" : "dia"}` : "—";
    }
    if (col === "status") {
      const options = getStatusOptions(r.tipo);
      const opt = options.find((o: any) => o.value === r.status);
      return opt?.label || r.status;
    }
    if (col === "alocacao") return getAlocacaoLabel(r.id);
    if (col === "periodo") return getPeriodoLabel(r.id);
    return "";
  }

  function getColsForTipo(tipo: TipoRecurso): ColKey[] {
    const isPessoa = tipo === "pessoa";
    const isVeiculo = tipo === "veiculo";
    let cols: ColKey[] = ["nome"];
    if (isPessoa) cols.push("cargo");
    if (isVeiculo) cols.push("placa");
    cols.push("custo", "status", "alocacao", "periodo");
    return cols;
  }

  function handleSort(tipo: TipoRecurso, col: ColKey) {
    setSortColumns(prev => {
      const current = prev[tipo];
      if (current === col && sortDirs[tipo] === "desc") return { ...prev, [tipo]: null };
      return { ...prev, [tipo]: col };
    });
    setSortDirs(prev => {
      if (sortColumns[tipo] === col) {
        return { ...prev, [tipo]: prev[tipo] === "asc" ? "desc" : prev[tipo] === "desc" ? null : "asc" };
      }
      return { ...prev, [tipo]: "asc" };
    });
  }

  function setSearchText(tipo: TipoRecurso, col: ColKey, v: string) {
    setSearchTexts(prev => ({ ...prev, [tipo]: { ...prev[tipo], [col]: v } }));
  }
  function toggleValue(tipo: TipoRecurso, col: ColKey, v: string) {
    setSelectedFilters(prev => {
      const next = new Set(prev[tipo][col]);
      next.has(v) ? next.delete(v) : next.add(v);
      return { ...prev, [tipo]: { ...prev[tipo], [col]: next } };
    });
  }
  function selectAll(tipo: TipoRecurso, col: ColKey, values: string[]) {
    setSelectedFilters(prev => ({ ...prev, [tipo]: { ...prev[tipo], [col]: new Set(values) } }));
  }
  function clearAll(tipo: TipoRecurso, col: ColKey) {
    setSelectedFilters(prev => ({ ...prev, [tipo]: { ...prev[tipo], [col]: new Set() } }));
  }
  function hasActiveFilters(tipo: TipoRecurso) {
    const cols = getColsForTipo(tipo);
    return cols.some(c => searchTexts[tipo][c] !== "" || selectedFilters[tipo][c].size > 0);
  }
  function clearAllFilters(tipo: TipoRecurso) {
    setSearchTexts(prev => ({ ...prev, [tipo]: { nome: "", cargo: "", placa: "", custo: "", status: "", alocacao: "", periodo: "" } }));
    setSelectedFilters(prev => ({ ...prev, [tipo]: { nome: new Set(), cargo: new Set(), placa: new Set(), custo: new Set(), status: new Set(), alocacao: new Set(), periodo: new Set() } }));
    setSortColumns(prev => ({ ...prev, [tipo]: null }));
    setSortDirs(prev => ({ ...prev, [tipo]: null }));
  }

  const grouped = useMemo(() => {
    const groups: Record<TipoRecurso, typeof recursos> = { pessoa: [], equipamento: [], veiculo: [] };
    recursos.forEach(r => groups[r.tipo]?.push(r));
    return groups;
  }, [recursos]);

  function getFilteredItems(tipo: TipoRecurso) {
    const cols = getColsForTipo(tipo);
    let items = [...grouped[tipo]];
    for (const col of cols) {
      const search = searchTexts[tipo][col].toLowerCase();
      const selected = selectedFilters[tipo][col];
      if (search) items = items.filter(r => getColValue(r, col).toLowerCase().includes(search));
      if (selected.size > 0) items = items.filter(r => selected.has(getColValue(r, col)));
    }
    const sc = sortColumns[tipo];
    const sd = sortDirs[tipo];
    if (sc && sd) {
      items.sort((a, b) => {
        const va = getColValue(a, sc).toLowerCase();
        const vb = getColValue(b, sc).toLowerCase();
        return sd === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return items;
  }

  function getUniqueValues(tipo: TipoRecurso, col: ColKey) {
    return Array.from(new Set(grouped[tipo].map(r => getColValue(r, col)))).sort();
  }

  const summary = useMemo(() => {
    const result: Record<TipoRecurso, number> = { pessoa: 0, equipamento: 0, veiculo: 0 };
    recursos.forEach((r) => {
      const c = getCustoAtual(r.id);
      if (c) result[r.tipo] += c.custo_unitario;
    });
    return result;
  }, [recursos, getCustoAtual]);

  // Gantt months based on all alocacoes
  const ganttMonths = useMemo(() => getGanttMonths(alocacoes), [alocacoes]);
  const ganttStartDate = ganttMonths.length > 0 ? ganttMonths[0] : new Date();
  const ganttTotalDays = ganttMonths.length > 0 ? differenceInDays(endOfMonth(ganttMonths[ganttMonths.length - 1]), ganttMonths[0]) + 1 : 180;
  const ganttTotalWidth = ganttMonths.length * MONTH_WIDTH;

  function getBarStyle(aloc: RecursoAlocacao) {
    const start = parseISO(aloc.data_inicio);
    const end = aloc.data_fim ? parseISO(aloc.data_fim) : addMonths(new Date(), 1);
    const startOffset = Math.max(0, differenceInDays(start, ganttStartDate));
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    const left = (startOffset / ganttTotalDays) * ganttTotalWidth;
    const width = (duration / ganttTotalDays) * ganttTotalWidth;
    return { left: `${left}px`, width: `${Math.max(width, 4)}px` };
  }

  function handleCreate() {
    if (!newNome.trim() || !newCusto) return;
    createRecurso.mutate(
      { nome: newNome.trim(), tipo: newTipo, unidade: newUnidade, custo_unitario: parseFloat(newCusto), data_inicio: newDataInicio, cargo: newTipo === "pessoa" && newCargo.trim() ? newCargo.trim() : undefined, placa: newTipo === "veiculo" && newPlaca.trim() ? newPlaca.trim() : undefined },
      { onSuccess: () => { setShowNew(false); setNewNome(""); setNewCusto(""); setNewCargo(""); setNewPlaca(""); } }
    );
  }

  function openEdit(id: string) {
    const r = recursos.find((x) => x.id === id);
    const c = getCustoAtual(id);
    if (r) {
      setEditNome(r.nome);
      setEditCargo(r.cargo || "");
      setEditPlaca(r.placa || "");
      setEditCusto(c ? String(c.custo_unitario) : "");
      setEditMotivo("");
      setEditDataInicio(new Date().toISOString().split("T")[0]);
      setEditRecurso(id);
    }
  }

  function handleEdit() {
    if (!editRecurso || !editCusto) return;
    const r = recursos.find((x) => x.id === editRecurso)!;
    const needsUpdate = editNome !== r.nome || (r.tipo === "pessoa" && editCargo !== (r.cargo || "")) || (r.tipo === "veiculo" && editPlaca !== (r.placa || ""));
    if (needsUpdate) {
      updateRecurso.mutate({ id: editRecurso, nome: editNome, ativo: r.ativo, cargo: r.tipo === "pessoa" ? editCargo || null : undefined, placa: r.tipo === "veiculo" ? editPlaca || null : undefined });
    }
    updateCusto.mutate(
      { recurso_id: editRecurso, custo_unitario: parseFloat(editCusto), data_inicio: editDataInicio, motivo: editMotivo || undefined },
      { onSuccess: () => setEditRecurso(null) }
    );
  }

  function handleDelete() {
    if (!deleteConfirmId) return;
    deleteRecurso.mutate(deleteConfirmId, { onSuccess: () => setDeleteConfirmId(null) });
  }

  function handleAlocar() {
    if (!alocarRecursoId || !alocSiteId || !alocProjetoId) return;
    alocarRecurso.mutate(
      { recurso_id: alocarRecursoId, site_id: alocSiteId, projeto_id: alocProjetoId, data_inicio: alocDataInicio, data_fim: alocDataFim || undefined },
      { onSuccess: () => { setAlocarRecursoId(null); setAlocProjetoId(""); setAlocSiteId(""); setAlocDataFim(""); } }
    );
  }

  function handleLiberar(recursoId: string) {
    const aloc = getAlocacaoAtiva(recursoId);
    if (!aloc) return;
    liberarRecurso.mutate({ alocacao_id: aloc.id, recurso_id: recursoId });
  }

  function handleStatusChange(recursoId: string, newStatus: string) {
    if (newStatus === "alocado") {
      setAlocarRecursoId(recursoId);
    } else if (newStatus === "ferias" || newStatus === "folga") {
      setStatusDateDialog({ recursoId, status: newStatus });
      setStatusDataInicio(new Date().toISOString().split("T")[0]);
      setStatusDataFim("");
    } else {
      const aloc = getAlocacaoAtiva(recursoId);
      if (aloc) {
        liberarRecurso.mutate({ alocacao_id: aloc.id, recurso_id: recursoId });
      }
      updateStatus.mutate({ id: recursoId, status: newStatus });
    }
  }

  function handleStatusDateConfirm() {
    if (!statusDateDialog) return;
    const aloc = getAlocacaoAtiva(statusDateDialog.recursoId);
    if (aloc) {
      liberarRecurso.mutate({ alocacao_id: aloc.id, recurso_id: statusDateDialog.recursoId });
    }
    // Create an allocation-like entry for férias/folga tracking
    updateStatus.mutate({ id: statusDateDialog.recursoId, status: statusDateDialog.status });
    setStatusDateDialog(null);
  }

  // Excel Export
  function handleExportExcel(tipo: TipoRecurso) {
    const items = getFilteredItems(tipo);
    const cols = getColsForTipo(tipo);
    const rows = items.map(r => {
      const row: Record<string, string> = {};
      cols.forEach(col => { row[columnLabels[col]] = getColValue(r, col); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipoConfig[tipo].label.replace(/[^\w\s]/g, "").trim());
    XLSX.writeFile(wb, `recursos_${tipo}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  function handleExportAll() {
    const wb = XLSX.utils.book_new();
    (["pessoa", "equipamento", "veiculo"] as TipoRecurso[]).forEach(tipo => {
      const items = getFilteredItems(tipo);
      const cols = getColsForTipo(tipo);
      const rows = items.map(r => {
        const row: Record<string, string> = {};
        cols.forEach(col => { row[columnLabels[col]] = getColValue(r, col); });
        return row;
      });
      if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, tipoConfig[tipo].label.replace(/[^\w\s]/g, "").trim());
      }
    });
    XLSX.writeFile(wb, `recursos_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  const sitesForProjeto = alocProjetoId ? sites.filter(s => (s as any).projeto_id === alocProjetoId || (s.projeto as any)?.id === alocProjetoId) : [];

  const histData = histRecurso ? getHistorico(histRecurso) : [];
  const histNome = histRecurso ? recursos.find((r) => r.id === histRecurso)?.nome : "";

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando recursos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">⚙️ Recursos da Obra</h2>
          <p className="text-muted-foreground">Gerencie pessoas, equipamentos e veículos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportAll}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => setShowImporter(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importar Excel
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Recurso
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["pessoa", "equipamento", "veiculo"] as TipoRecurso[]).map((tipo) => {
          const cfg = tipoConfig[tipo];
          const count = recursos.filter((r) => r.tipo === tipo).length;
          const alocados = recursos.filter(r => r.tipo === tipo && r.status === "alocado").length;
          return (
            <Card key={tipo}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{cfg.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                  <p className="text-xs text-muted-foreground">{alocados} alocados</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Custo total ativo</p>
                  <p className="font-semibold tabular-nums">R$ {summary[tipo].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grouped lists with Gantt */}
      {(["pessoa", "equipamento", "veiculo"] as TipoRecurso[]).map((tipo) => {
        const items = getFilteredItems(tipo);
        const allItems = grouped[tipo];
        if (allItems.length === 0) return null;

        const totalItems = items.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPages[tipo]));
        const paginatedItems = items.slice((currentPages[tipo] - 1) * itemsPerPages[tipo], currentPages[tipo] * itemsPerPages[tipo]);

        const cfg = tipoConfig[tipo];
        const cols = getColsForTipo(tipo);

        return (
          <Card key={tipo}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{cfg.label} ({items.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportExcel(tipo)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  {hasActiveFilters(tipo) && (
                    <Button variant="ghost" size="sm" onClick={() => clearAllFilters(tipo)}>
                      <X className="h-4 w-4 mr-1" /> Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex">
                {/* Fixed data columns + actions */}
                <div className="flex-shrink-0 border-r z-10 bg-background">
                  <Table className="w-auto table-fixed">
                    <TableHeader>
                      <TableRow style={{ height: 60 }}>
                        {cols.map(col => (
                          <TableHead key={col} className="whitespace-nowrap">
                            <ColumnHeader
                              label={columnLabels[col]}
                              sortDir={sortColumns[tipo] === col ? sortDirs[tipo] : null}
                              onSort={() => handleSort(tipo, col)}
                              searchText={searchTexts[tipo][col]}
                              onSearchChange={(v) => setSearchText(tipo, col, v)}
                              uniqueValues={getUniqueValues(tipo, col)}
                              selectedValues={selectedFilters[tipo][col]}
                              onToggleValue={(v) => toggleValue(tipo, col, v)}
                              onSelectAll={() => selectAll(tipo, col, getUniqueValues(tipo, col))}
                              onClearAll={() => clearAll(tipo, col)}
                            />
                          </TableHead>
                        ))}
                        <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.length === 0 ? (
                        <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-muted-foreground py-6">Nenhum resultado</TableCell></TableRow>
                      ) : paginatedItems.map((r) => {
                        const custo = getCustoAtual(r.id);
                        const aloc = getAlocacaoAtiva(r.id);
                        return (
                          <TableRow key={r.id} style={{ height: 48 }}>
                            <TableCell className="font-medium whitespace-nowrap">{r.nome}</TableCell>
                            {tipo === "pessoa" && <TableCell className="whitespace-nowrap">{r.cargo || "—"}</TableCell>}
                            {tipo === "veiculo" && <TableCell className="whitespace-nowrap">{r.placa || "—"}</TableCell>}
                            <TableCell className="tabular-nums whitespace-nowrap">
                              {custo ? (
                                <span>R$ {custo.custo_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/{r.unidade === "hora" ? "h" : "dia"}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                                <SelectTrigger className="h-8 w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getStatusOptions(tipo).map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {aloc ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {getAlocacaoLabel(r.id)}
                                  </Badge>
                                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => handleLiberar(r.id)}>
                                    Liberar
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setAlocarRecursoId(r.id); setAlocProjetoId(""); setAlocSiteId(""); setAlocDataFim(""); }}>
                                  <Link2 className="h-3 w-3" /> Alocar
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {aloc ? (
                                <span>
                                  {new Date(aloc.data_inicio).toLocaleDateString("pt-BR")}
                                  {" — "}
                                  {aloc.data_fim ? new Date(aloc.data_fim).toLocaleDateString("pt-BR") : "Em aberto"}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(r.id)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setHistRecurso(r.id)}>
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(r.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Scrollable Gantt area */}
                <div className="flex-1 overflow-x-auto min-w-0">
                  <Table className="w-auto table-fixed">
                    <TableHeader>
                      <TableRow>
                        {ganttMonths.map((m, i) => {
                          const daysInMonth = getDaysInMonth(m);
                          const monthWidth = daysInMonth * DAY_WIDTH;
                          return (
                            <TableHead key={i} className="text-center text-xs whitespace-nowrap border-l p-0 h-[60px]" style={{ minWidth: monthWidth, width: monthWidth }}>
                              <div className="flex flex-col h-full w-full">
                                <div className="py-2 bg-muted/20 font-semibold text-muted-foreground uppercase flex-none">
                                  {format(m, "MMMM/yyyy", { locale: ptBR })}
                                </div>
                                <div className="flex items-center flex-1 w-full border-t bg-muted/5">
                                  {Array.from({ length: daysInMonth }).map((_, d) => (
                                    <div key={d} className="flex-1 text-center border-r last:border-0 border-muted-foreground/20 text-[10px] text-muted-foreground" style={{ minWidth: DAY_WIDTH }}>
                                      {d + 1}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.length === 0 ? (
                        <TableRow><TableCell colSpan={ganttMonths.length} className="py-6">&nbsp;</TableCell></TableRow>
                      ) : paginatedItems.map((r) => {
                        const recursoAlocacoes = alocacoes.filter(a => a.recurso_id === r.id);
                        return (
                          <TableRow key={r.id}>
                            {ganttMonths.map((m, i) => {
                              const monthStart = m;
                              const monthEnd = endOfMonth(m);
                              const daysInMonth = getDaysInMonth(m);
                              const monthWidth = daysInMonth * DAY_WIDTH;

                              return (
                                <TableCell key={i} className="p-0 border-l relative" style={{ minWidth: monthWidth, width: monthWidth, height: 48 }}>
                                  {/* Grid Lines */}
                                  <div className="absolute inset-0 flex z-0 pointer-events-none">
                                    {Array.from({ length: daysInMonth }).map((_, d) => (
                                      <div key={d} className="flex-1 h-full border-r border-muted/20" style={{ minWidth: DAY_WIDTH }} />
                                    ))}
                                  </div>
                                  
                                  {/* Bars */}
                                  {recursoAlocacoes.map(a => {
                                    const aStart = parseISO(a.data_inicio);
                                    const aEnd = a.data_fim ? parseISO(a.data_fim) : addMonths(new Date(), 1);
                                    if (isAfter(aStart, monthEnd) || isBefore(aEnd, monthStart)) return null;
                                    const barStart = isBefore(aStart, monthStart) ? monthStart : aStart;
                                    const barEnd = isAfter(aEnd, monthEnd) ? monthEnd : aEnd;
                                    const barStartDay = differenceInDays(barStart, monthStart);
                                    const barDuration = differenceInDays(barEnd, barStart) + 1;
                                    
                                    const left = (barStartDay / daysInMonth) * 100;
                                    const width = (barDuration / daysInMonth) * 100;
                                    return (
                                      <div
                                        key={a.id}
                                        className="absolute top-1/2 -translate-y-1/2 rounded-sm opacity-90 hover:opacity-100 transition-opacity z-10 shadow-sm"
                                        style={{
                                          left: `${left}%`,
                                          width: `${Math.min(width, 100)}%`,
                                          height: "60%",
                                          backgroundColor: ganttColors[tipo],
                                          border: a.data_fim === null ? "1px dashed hsl(var(--foreground) / 0.5)" : "none",
                                        }}
                                        title={`${sites.find(s => s.id === a.site_id)?.codigo || "?"}: ${new Date(a.data_inicio).toLocaleDateString("pt-BR")} — ${a.data_fim ? new Date(a.data_fim).toLocaleDateString("pt-BR") : "Em aberto"}`}
                                      />
                                    );
                                  })}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
            {items.length > 0 && (
              <div className="p-4 border-t">
                <TablePagination
                  currentPage={currentPages[tipo]}
                  totalPages={totalPages}
                  onPageChange={(p) => setCurrentPages(prev => ({ ...prev, [tipo]: p }))}
                  itemsPerPage={itemsPerPages[tipo]}
                  onItemsPerPageChange={(limit) => {
                    setItemsPerPages(prev => ({ ...prev, [tipo]: limit }));
                    setCurrentPages(prev => ({ ...prev, [tipo]: 1 }));
                  }}
                  totalItems={items.length}
                />
              </div>
            )}
          </Card>
        );
      })}

      {recursos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum recurso encontrado. Clique em "Novo Recurso" para adicionar.
          </CardContent>
        </Card>
      )}

      {/* New Resource Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>➕ Novo Recurso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Ex: Escavadeira CAT 320" />
            </div>
            <div>
              <Label>Tipo</Label>
              <RadioGroup value={newTipo} onValueChange={(v) => setNewTipo(v as TipoRecurso)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="pessoa" id="t-p" /><Label htmlFor="t-p">Pessoa</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="equipamento" id="t-e" /><Label htmlFor="t-e">Equipamento</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="veiculo" id="t-v" /><Label htmlFor="t-v">Veículo</Label></div>
              </RadioGroup>
            </div>
            {newTipo === "pessoa" && (
              <div>
                <Label>Cargo / Função</Label>
                <Input value={newCargo} onChange={(e) => setNewCargo(e.target.value)} placeholder="Ex: Pedreiro, Servente, Encarregado" />
              </div>
            )}
            {newTipo === "veiculo" && (
              <div>
                <Label>Placa</Label>
                <Input value={newPlaca} onChange={(e) => setNewPlaca(e.target.value)} placeholder="Ex: ABC-1D23" />
              </div>
            )}
            <div>
              <Label>Unidade</Label>
              <RadioGroup value={newUnidade} onValueChange={(v) => setNewUnidade(v as UnidadeRecurso)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="hora" id="u-h" /><Label htmlFor="u-h">Hora</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="dia" id="u-d" /><Label htmlFor="u-d">Dia</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Custo atual (R$)</Label>
              <Input type="number" value={newCusto} onChange={(e) => setNewCusto(e.target.value)} placeholder="200" />
            </div>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={newDataInicio} onChange={(e) => setNewDataInicio(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={createRecurso.isPending}>
              {createRecurso.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRecurso} onOpenChange={() => setEditRecurso(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>✏️ Editar Recurso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            {editRecurso && recursos.find(r => r.id === editRecurso)?.tipo === "pessoa" && (
              <div>
                <Label>Cargo / Função</Label>
                <Input value={editCargo} onChange={(e) => setEditCargo(e.target.value)} placeholder="Ex: Pedreiro, Servente" />
              </div>
            )}
            {editRecurso && recursos.find(r => r.id === editRecurso)?.tipo === "veiculo" && (
              <div>
                <Label>Placa</Label>
                <Input value={editPlaca} onChange={(e) => setEditPlaca(e.target.value)} placeholder="Ex: ABC-1D23" />
              </div>
            )}
            <div>
              <Label>Custo atual (R$)</Label>
              <Input type="number" value={editCusto} onChange={(e) => setEditCusto(e.target.value)} />
            </div>
            <div>
              <Label>Motivo da alteração</Label>
              <Input value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)} placeholder="Ex: Aumento contrato fornecedor" />
            </div>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={editDataInicio} onChange={(e) => setEditDataInicio(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleEdit} disabled={updateCusto.isPending}>
              {updateCusto.isPending ? "Salvando..." : "Salvar alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!histRecurso} onOpenChange={() => setHistRecurso(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>📊 Histórico de Custos</DialogTitle></DialogHeader>
          <p className="font-medium mb-3">{histNome}</p>
          {histData.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum histórico disponível.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histData.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.data_inicio).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{h.data_fim ? new Date(h.data_fim).toLocaleDateString("pt-BR") : "Atual"}</TableCell>
                    <TableCell className="tabular-nums">R$ {h.custo_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{h.motivo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>🗑️ Excluir Recurso</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o recurso <strong>{recursos.find(r => r.id === deleteConfirmId)?.nome}</strong>?
            Esta ação não pode ser desfeita e removerá todo o histórico de custos e alocações associados.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRecurso.isPending}>
              {deleteRecurso.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Allocation Dialog */}
      <Dialog open={!!alocarRecursoId} onOpenChange={() => setAlocarRecursoId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>📍 Alocar Recurso</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Alocando: <strong>{recursos.find(r => r.id === alocarRecursoId)?.nome}</strong>
          </p>
          <div className="space-y-4">
            <div>
              <Label>Projeto</Label>
              <Select value={alocProjetoId} onValueChange={(v) => { setAlocProjetoId(v); setAlocSiteId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={alocSiteId} onValueChange={setAlocSiteId} disabled={!alocProjetoId}>
                <SelectTrigger>
                  <SelectValue placeholder={alocProjetoId ? "Selecione o site" : "Selecione um projeto primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {sitesForProjeto.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={alocDataInicio} onChange={(e) => setAlocDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data fim (opcional)</Label>
                <Input type="date" value={alocDataFim} onChange={(e) => setAlocDataFim(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleAlocar} disabled={!alocSiteId || alocarRecurso.isPending}>
              {alocarRecurso.isPending ? "Alocando..." : "Confirmar Alocação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Férias / Folga date dialog */}
      <Dialog open={!!statusDateDialog} onOpenChange={() => setStatusDateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDateDialog?.status === "ferias" ? "🏖️ Definir Férias" : "😴 Definir Folga"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Recurso: <strong>{statusDateDialog && recursos.find(r => r.id === statusDateDialog.recursoId)?.nome}</strong>
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={statusDataInicio} onChange={(e) => setStatusDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={statusDataFim} onChange={(e) => setStatusDataFim(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleStatusDateConfirm}>
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <RecursosImporter open={showImporter} onOpenChange={setShowImporter} />
    </div>
  );
}
