import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarRange,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Wand2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFlashNormalizacao,
  type FlashTransactionRow,
  type ContaAzulOption,
} from "@/hooks/useFlashNormalizacao";
import { normalizeFlashTransaction } from "@/lib/flashNormalization";
import { exportNormalizacaoFlashToExcel } from "@/lib/flashNormalizacaoExport";
import { cn } from "@/lib/utils";

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

const statusBadge = (status: string | undefined) => {
  switch (status) {
    case "normalizado":
      return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20">Normalizado</Badge>;
    case "enviado":
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">Enviado</Badge>;
    default:
      return <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-300">Pendente</Badge>;
  }
};

interface OptionSelectProps {
  options: ContaAzulOption[];
  value: string | null | undefined;
  onChange: (id: string, name: string) => void;
  placeholder: string;
  disabled?: boolean;
}

function OptionSelect({ options, value, onChange, placeholder, disabled }: OptionSelectProps) {
  return (
    <Select
      value={value || ""}
      onValueChange={(v) => {
        const opt = options.find((o) => o.id === v);
        onChange(v, opt?.name || "");
      }}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">Nenhuma opção</div>
        )}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} className="text-xs">
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function NormalizacaoFlashPage() {
  const {
    loading,
    savingId,
    sending,
    transactions,
    categorias,
    contas,
    mappings,
    mappingByType,
    loadingMetadata,
    metadataError,
    refresh,
    refreshMetadata,
    saveNormalization,
    applyMappingToAllPending,
    bulkApplyToPending,
    reopenEnviado,
    sendToContaAzul,
  } = useFlashNormalizacao();

  const handleRefresh = async () => {
    setLoadingFilter(true);
    try {
      console.log("Manual refresh triggered");
      await refresh(true);
      // O hook já emite o toast de sucesso e faz o log
    } catch (error: any) {
      console.error("Erro ao recarregar manualmente:", error);
      toast.error("Erro ao recarregar", { description: error.message });
    } finally {
      setLoadingFilter(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingFilter, setLoadingFilter] = useState(false);
  
  // Status filter from URL
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "todos");
  // Search filter from URL
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [tab, setTab] = useState<"lancamentos" | "pendentes" | "mapeamentos">((searchParams.get("tab") as any) || "lancamentos");

  // Multi-select filters from URL
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    searchParams.get("users")?.split(",").filter(Boolean) || []
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    searchParams.get("types")?.split(",").filter(Boolean) || []
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean) || []
  );
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>(
    searchParams.get("costCenters")?.split(",").filter(Boolean) || []
  );

  // Period filter (applies to all tabs)
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState<string>(searchParams.get("to") || "");
  
  // Sort from URL
  const [sortConfig, setSortConfig] = useState<{ key: keyof FlashTransactionRow; direction: 'asc' | 'desc' } | null>(
    searchParams.get("sort") ? {
      key: searchParams.get("sort") as keyof FlashTransactionRow,
      direction: (searchParams.get("dir") as 'asc' | 'desc') || 'asc'
    } : null
  );
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1"));
  const itemsPerPage = 50;

  // Reset page when filters change (but NOT when changing date range or sorting, 
  // if we want to preserve them, but usually filters should reset page to 1)
  useEffect(() => {
    // Only reset if it's not the initial mount from URL
    const params = new URLSearchParams(window.location.search);
    if (!params.get("page")) {
      setCurrentPage(1);
    }
  }, [statusFilter, search, selectedUsers, selectedTypes, selectedCategories, selectedCostCenters]);

  // Update URL search params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "todos") params.set("status", statusFilter);
    if (search) params.set("q", search);
    if (selectedUsers.length > 0) params.set("users", selectedUsers.join(","));
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    if (selectedCostCenters.length > 0) params.set("costCenters", selectedCostCenters.join(","));
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (tab !== "lancamentos") params.set("tab", tab);
    if (currentPage > 1) params.set("page", currentPage.toString());
    if (sortConfig) {
      params.set("sort", sortConfig.key as string);
      params.set("dir", sortConfig.direction);
    }
    
    // Use replace: true to avoid filling history with every keystroke
    setSearchParams(params, { replace: true });
  }, [statusFilter, search, selectedUsers, selectedTypes, selectedCategories, selectedCostCenters, sortConfig, dateFrom, dateTo, tab, currentPage, setSearchParams]);

  // Dialogs
  const [payloadDialogRow, setPayloadDialogRow] = useState<FlashTransactionRow | null>(null);
  const [motivoDialogRow, setMotivoDialogRow] = useState<FlashTransactionRow | null>(null);
  const [confirmReopenRow, setConfirmReopenRow] = useState<FlashTransactionRow | null>(null);

  // Selection for bulk sending
  const [selectedToSendIds, setSelectedToSendIds] = useState<string[]>([]);

  // Bulk pendentes
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [bulkCat, setBulkCat] = useState<{ id: string; name: string } | null>(null);
  const [bulkAcc, setBulkAcc] = useState<{ id: string; name: string } | null>(null);
  const [bulkTipo, setBulkTipo] = useState<"receita" | "despesa">("despesa");
  const [bulkSaveMapping, setBulkSaveMapping] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);

  // Efeito para fixar a conta financeira padrão "Flash" (qualquer conta com 'flash' no nome)
  useEffect(() => {
    const flashAccount = contas.find(c => c.name?.toLowerCase().includes("flash"));
    if (flashAccount) {
      setBulkAcc({ id: flashAccount.id, name: flashAccount.name });
    }
  }, [contas]);

  // Helper: parse a tx date as a comparable yyyy-mm-dd string (or null)
  // Avoids UTC conversion — we extract the date portion directly from the string.
  const txDateKey = (d: string | null): string | null => {
    if (!d) return null;
    // Direct yyyy-mm-dd or starts with it (e.g. "2026-04-07T...")
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return null;
  };

  // Apply the period filter first — used by all tabs
  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return transactions;
    return transactions.filter((t) => {
      const k = txDateKey(t.data);
      if (!k) return !dateFrom && !dateTo ? true : false;
      if (dateFrom && k < dateFrom) return false;
      if (dateTo && k > dateTo) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  // Extract unique values for filters (from period-filtered data)
  const filterOptions = useMemo(() => {
    const users = Array.from(new Set(dateFiltered.map(t => t.usuario))).filter(Boolean).sort();
    const types = Array.from(new Set(dateFiltered.map(t => t.flash_type))).filter(Boolean).sort();
    const categories = Array.from(new Set(dateFiltered.map(t => t.flash_category))).filter(Boolean).sort();
    const costCenters = Array.from(new Set(dateFiltered.map(t => t.flash_cost_center))).filter(Boolean).sort();
    
    return { users, types, categories, costCenters };
  }, [dateFiltered]);

  const filtered = useMemo(() => {
    let result = dateFiltered.filter((t) => {
      if (statusFilter !== "todos" && t.status !== statusFilter) return false;
      
      // Multi-select filters
      if (selectedUsers.length > 0 && !selectedUsers.includes(t.usuario)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(t.flash_type)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.flash_category)) return false;
      if (selectedCostCenters.length > 0 && !selectedCostCenters.includes(t.flash_cost_center)) return false;

      // Novos filtros nos cabeçalhos
      const dataFilter = searchParams.get("data")?.split(",").filter(Boolean) || [];
      if (dataFilter.length > 0 && !dataFilter.includes(formatDate(t.data))) return false;

      const descFilter = searchParams.get("desc")?.split(",").filter(Boolean) || [];
      if (descFilter.length > 0 && !descFilter.includes(t.descricao)) return false;

      const valFilter = searchParams.get("val")?.split(",").filter(Boolean) || [];
      if (valFilter.length > 0 && !valFilter.includes(formatCurrency(t.valor))) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !t.descricao.toLowerCase().includes(q) &&
          !t.usuario.toLowerCase().includes(q) &&
          !t.flash_type.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [dateFiltered, statusFilter, search, selectedUsers, selectedTypes, selectedCategories, selectedCostCenters, sortConfig, searchParams]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const pendentes = useMemo(
    () => dateFiltered.filter((t) => t.status === "pendente"),
    [dateFiltered]
  );

  const counts = useMemo(() => {
    return dateFiltered.reduce(
      (acc, t) => {
        acc.total += 1;
        if (t.status === "normalizado") acc.normalizado += 1;
        else if (t.status === "enviado") acc.enviado += 1;
        else acc.pendente += 1;
        return acc;
      },
      { total: 0, pendente: 0, normalizado: 0, enviado: 0 }
    );
  }, [dateFiltered]);

  const handleApplyMapping = async (row: FlashTransactionRow) => {
    // Agora usamos a lógica inteligente exportada para encontrar o melhor mapping
    const normalized = normalizeFlashTransaction(
      { 
        id: row.id, 
        external_id: row.external_id, 
        payload_json: row.payload_json, 
        flash_type: row.flash_type,
        flash_category: row.flash_category,
        flash_cost_center: row.flash_cost_center,
        descricao: row.descricao
      },
      mappings as any[]
    );

    if (normalized.status === "normalizado") {
      await saveNormalization(row, {
        conta_azul_category_id: normalized.conta_azul_category_id,
        conta_azul_category_name: normalized.conta_azul_category_name,
        conta_azul_account_id: normalized.conta_azul_account_id,
        conta_azul_account_name: normalized.conta_azul_account_name,
        tipo_operacao: normalized.tipo_operacao,
        status: "normalizado",
      });
    } else {
      toast.info("Nenhum mapeamento compatível encontrado para este lançamento específico.");
    }
  };

  const handleExport = () => {
    try {
      exportNormalizacaoFlashToExcel(filtered.length ? filtered : transactions);
      toast.success("Planilha exportada com sucesso");
    } catch (e: any) {
      toast.error("Falha ao exportar", { description: e.message });
    }
  };

  const togglePendingSelect = (id: string, checked: boolean) => {
    setSelectedPendingIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  };

  const allPendingSelected =
    pendentes.length > 0 && selectedPendingIds.length === pendentes.length;

  const togglePendingAll = (checked: boolean) => {
    setSelectedPendingIds(checked ? pendentes.map((p) => p.id) : []);
  };

  const handleBulkApply = async () => {
    if (!bulkCat || !bulkAcc) {
      toast.error("Selecione categoria e conta financeira");
      return;
    }
    if (!selectedPendingIds.length) {
      toast.error("Selecione ao menos um lançamento pendente");
      return;
    }
    setBulkApplying(true);
    try {
      await bulkApplyToPending(selectedPendingIds, {
        conta_azul_category_id: bulkCat.id,
        conta_azul_category_name: bulkCat.name,
        conta_azul_account_id: bulkAcc.id,
        conta_azul_account_name: bulkAcc.name,
        tipo_operacao: bulkTipo,
        saveMappingPerType: bulkSaveMapping,
      });
      setSelectedPendingIds([]);
    } finally {
      setBulkApplying(false);
    }
  };

  const toggleSort = (key: keyof FlashTransactionRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const MultiSelectFilter = ({ 
    title, 
    options, 
    selected, 
    onSelect 
  }: { 
    title: string; 
    options: string[]; 
    selected: string[]; 
    onSelect: (val: string[]) => void 
  }) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <Filter className="mr-2 h-3 w-3" />
            {title}
            {selected.length > 0 && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                  {selected.length}
                </Badge>
                <div className="hidden space-x-1 lg:flex">
                  {selected.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selected.length} selecionados
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selected.includes(option))
                      .map((option) => (
                        <Badge variant="secondary" key={option} className="rounded-sm px-1 font-normal">
                          {option}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
            <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder={title} />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <CommandItem
                      key={option}
                      onSelect={() => {
                        if (isSelected) {
                          onSelect(selected.filter((s) => s !== option));
                        } else {
                          onSelect([...selected, option]);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Checkbox checked={isSelected} className="h-3 w-3" />
                      </div>
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selected.length > 0 && (
                <>
                  <Separator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onSelect([])}
                      className="justify-center text-center"
                    >
                      Limpar filtros
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // Compact filter to embed inside a column header (icon button).
  const ColumnHeaderFilter = ({
    title,
    options,
    selected,
    onSelect,
  }: {
    title: string;
    options: string[];
    selected: string[];
    onSelect: (val: string[]) => void;
  }) => {
    const active = selected.length > 0;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 shrink-0", active && "text-primary")}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Filtrar ${title}`}
          >
            <Filter className={cn("h-3 w-3", active && "fill-current")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[220px] p-0"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder={`Filtrar ${title}...`} />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <CommandItem
                      key={option}
                      onSelect={() => {
                        if (isSelected) {
                          onSelect(selected.filter((s) => s !== option));
                        } else {
                          onSelect([...selected, option]);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Checkbox checked={isSelected} className="h-3 w-3" />
                      </div>
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {active && (
                <>
                  <Separator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onSelect([])}
                      className="justify-center text-center"
                    >
                      Limpar
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const SortIcon = ({ column }: { column: keyof FlashTransactionRow }) => {
    if (sortConfig?.key !== column) return <ArrowUpAZ className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUpAZ className="ml-2 h-3 w-3" /> : <ArrowDownAZ className="ml-2 h-3 w-3" />;
  };

  const renderActionButtons = (row: FlashTransactionRow) => {
    const hasMapping = mappingByType.has(row.flash_type);
    const isSaving = savingId === row.id;
    const isEnviado = row.status === "enviado";
    return (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setMotivoDialogRow(row)}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver motivo da normalização</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPayloadDialogRow(row)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver payload pronto</TooltipContent>
        </Tooltip>
        {hasMapping && row.status === "pendente" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => handleApplyMapping(row)}
                disabled={isSaving}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aplicar mapeamento salvo</TooltipContent>
          </Tooltip>
        )}
        {row.status === "normalizado" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600"
                disabled={sending}
                onClick={() => sendToContaAzul([row.id])}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar ao Conta Azul</TooltipContent>
          </Tooltip>
        )}
        {isEnviado ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-amber-600"
                onClick={() => setConfirmReopenRow(row)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reabrir para correção</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={
                  isSaving ||
                  !row.conta_azul_category_id ||
                  !row.conta_azul_account_id
                }
                onClick={() =>
                  saveNormalization(
                    row,
                    { status: "normalizado" },
                    { saveMapping: true }
                  )
                }
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salvar e criar mapeamento</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Normalização Flash</h1>
          <p className="text-sm text-muted-foreground">
            Associe os lançamentos da Flash com categorias e contas do Conta Azul antes do envio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || transactions.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={refreshMetadata} disabled={loadingMetadata}>
            {loadingMetadata ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar Conta Azul
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={loading || loadingFilter}
          >
            {loading || loadingFilter ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Recarregar retornos
          </Button>
          <Button size="sm" onClick={applyMappingToAllPending} disabled={mappings.length === 0}>
            <Wand2 className="h-4 w-4 mr-2" />
            Aplicar mapeamentos aos pendentes
          </Button>
          <Button
            size="sm"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={sending || selectedToSendIds.length === 0}
            onClick={() => {
              if (!selectedToSendIds.length) return;
              sendToContaAzul(selectedToSendIds).then(() => {
                setSelectedToSendIds([]);
              });
            }}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar selecionados ({selectedToSendIds.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
            disabled={sending || counts.normalizado === 0}
            onClick={() => {
              const ids = transactions
                .filter((t) => t.status === "normalizado")
                .map((t) => t.id);
              if (!ids.length) return;
              sendToContaAzul(ids);
            }}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar todos normalizados ({counts.normalizado})
          </Button>
        </div>
      </div>

      {metadataError && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-amber-700 dark:text-amber-300">
            ⚠ {metadataError}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{counts.pendente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Normalizados</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{counts.normalizado}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Enviados</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{counts.enviado}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de período global — vale para Lançamentos, Pendentes e contadores */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span>Período</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">De</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Até</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Limpar período
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {dateFrom || dateTo
                ? `Aplicado a todas as abas — ${dateFiltered.length} lançamento(s) no período`
                : "Sem filtro — exibindo todos os lançamentos"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="pendentes">Revisar Pendentes ({counts.pendente})</TabsTrigger>
          <TabsTrigger value="mapeamentos">Mapeamentos salvos ({mappings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Lançamentos Flash</CardTitle>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar descrição, usuário..."
                        className="pl-8 h-9 w-[250px]"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os status</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="normalizado">Normalizado</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(selectedUsers.length > 0 || selectedTypes.length > 0 || selectedCategories.length > 0 || selectedCostCenters.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Filtros ativos nas colunas:</span>
                    {selectedUsers.length > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Usuário ({selectedUsers.length})
                      </Badge>
                    )}
                    {selectedTypes.length > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Tipo Flash ({selectedTypes.length})
                      </Badge>
                    )}
                    {selectedCategories.length > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Categoria Flash ({selectedCategories.length})
                      </Badge>
                    )}
                    {selectedCostCenters.length > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        Centro de Custo ({selectedCostCenters.length})
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUsers([]);
                        setSelectedTypes([]);
                        setSelectedCategories([]);
                        setSelectedCostCenters([]);
                      }}
                      className="h-7 px-2"
                    >
                      Limpar
                      <RotateCcw className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground animate-pulse">Carregando lançamentos...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 opacity-20" />
                  <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
                  <Button variant="link" onClick={() => {
                    setSearch("");
                    setStatusFilter("todos");
                    setSelectedUsers([]);
                    setSelectedTypes([]);
                    setSelectedCategories([]);
                    setSelectedCostCenters([]);
                  }}>
                    Limpar todos os filtros
                  </Button>
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <div className="overflow-x-auto relative min-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox 
                              checked={paginatedData.length > 0 && paginatedData.every(r => r.status === 'normalizado' ? selectedToSendIds.includes(r.id) : true)}
                              onCheckedChange={(checked) => {
                                const normalizadosInPage = paginatedData.filter(r => r.status === 'normalizado').map(r => r.id);
                                if (checked) {
                                  setSelectedToSendIds(prev => Array.from(new Set([...prev, ...normalizadosInPage])));
                                } else {
                                  setSelectedToSendIds(prev => prev.filter(id => !normalizadosInPage.includes(id)));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead 
                            className="w-[110px] cursor-pointer group"
                            onClick={() => toggleSort('data')}
                          >
                            <div className="flex items-center gap-1">
                              <div className="flex items-center">Data <SortIcon column="data" /></div>
                              <ColumnHeaderFilter
                                title="Data"
                                options={Array.from(new Set(dateFiltered.map(t => formatDate(t.data)))).filter(Boolean).sort()}
                                selected={searchParams.get("data")?.split(",").filter(Boolean) || []}
                                onSelect={(val) => {
                                  const params = new URLSearchParams(searchParams);
                                  if (val.length > 0) params.set("data", val.join(","));
                                  else params.delete("data");
                                  setSearchParams(params, { replace: true });
                                }}
                              />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer group"
                            onClick={() => toggleSort('descricao')}
                          >
                            <div className="flex items-center gap-1">
                              <div className="flex items-center">Descrição <SortIcon column="descricao" /></div>
                              <ColumnHeaderFilter
                                title="Descrição"
                                options={Array.from(new Set(dateFiltered.map(t => t.descricao))).filter(Boolean).sort()}
                                selected={searchParams.get("desc")?.split(",").filter(Boolean) || []}
                                onSelect={(val) => {
                                  const params = new URLSearchParams(searchParams);
                                  if (val.length > 0) params.set("desc", val.join(","));
                                  else params.delete("desc");
                                  setSearchParams(params, { replace: true });
                                }}
                              />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="w-[130px] text-right cursor-pointer group"
                            onClick={() => toggleSort('valor')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <div className="flex items-center">Valor <SortIcon column="valor" /></div>
                              <ColumnHeaderFilter
                                title="Valor"
                                options={Array.from(new Set(dateFiltered.map(t => formatCurrency(t.valor)))).filter(Boolean).sort()}
                                selected={searchParams.get("val")?.split(",").filter(Boolean) || []}
                                onSelect={(val) => {
                                  const params = new URLSearchParams(searchParams);
                                  if (val.length > 0) params.set("val", val.join(","));
                                  else params.delete("val");
                                  setSearchParams(params, { replace: true });
                                }}
                              />
                            </div>
                          </TableHead>
                           <TableHead className="w-[140px]">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex items-center group"
                                onClick={() => toggleSort('usuario')}
                              >
                                Usuário <SortIcon column="usuario" />
                              </button>
                              <ColumnHeaderFilter
                                title="Usuário"
                                options={filterOptions.users}
                                selected={selectedUsers}
                                onSelect={setSelectedUsers}
                              />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="w-[150px] cursor-pointer group"
                            onClick={() => toggleSort('comentarios')}
                          >
                            <div className="flex items-center">Comentários <SortIcon column="comentarios" /></div>
                          </TableHead>
                          <TableHead className="w-[150px]">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex items-center group"
                                onClick={() => toggleSort('flash_type')}
                              >
                                Tipo Flash <SortIcon column="flash_type" />
                              </button>
                              <ColumnHeaderFilter
                                title="Tipo Flash"
                                options={filterOptions.types}
                                selected={selectedTypes}
                                onSelect={setSelectedTypes}
                              />
                            </div>
                          </TableHead>
                          <TableHead className="w-[150px]">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex items-center group"
                                onClick={() => toggleSort('flash_category')}
                              >
                                Categoria Flash <SortIcon column="flash_category" />
                              </button>
                              <ColumnHeaderFilter
                                title="Categoria Flash"
                                options={filterOptions.categories}
                                selected={selectedCategories}
                                onSelect={setSelectedCategories}
                              />
                            </div>
                          </TableHead>
                          <TableHead className="w-[150px]">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex items-center group"
                                onClick={() => toggleSort('flash_cost_center')}
                              >
                                Centro de Custo <SortIcon column="flash_cost_center" />
                              </button>
                              <ColumnHeaderFilter
                                title="Centro de Custo"
                                options={filterOptions.costCenters}
                                selected={selectedCostCenters}
                                onSelect={setSelectedCostCenters}
                              />
                            </div>
                          </TableHead>
                          <TableHead className="w-[200px]">Categoria CA</TableHead>
                          <TableHead className="w-[200px]">Conta financeira CA</TableHead>
                          <TableHead className="w-[160px]">Status (Prestação Flash)</TableHead>
                          <TableHead className="w-[160px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map((row) => {
                          const hasMapping = mappingByType.has(row.flash_type);
                          const isEnviado = row.status === "enviado";
                          const fieldsDisabled = isEnviado || loadingMetadata;
                          return (
                            <TableRow key={row.id} className={isEnviado ? "opacity-80" : undefined}>
                              <TableCell>
                                {row.status === "normalizado" && (
                                  <Checkbox 
                                    checked={selectedToSendIds.includes(row.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedToSendIds(prev => 
                                        checked ? [...prev, row.id] : prev.filter(id => id !== row.id)
                                      );
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{formatDate(row.data)}</TableCell>
                              <TableCell className="max-w-[300px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate text-xs">{row.descricao}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs break-words">{row.descricao}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium tabular-nums">
                                {formatCurrency(row.valor)}
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]">{row.usuario}</TableCell>
                              <TableCell className="text-xs truncate max-w-[150px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate">{row.comentarios}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs break-words">{row.comentarios}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {row.flash_type}
                                  </Badge>
                                  {hasMapping && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>Mapeamento disponível</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]">
                                {row.flash_category}
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[120px]">
                                {row.flash_cost_center}
                              </TableCell>
                              <TableCell>
                                <OptionSelect
                                  options={categorias}
                                  value={row.conta_azul_category_id}
                                  onChange={(id, name) =>
                                    saveNormalization(row, {
                                      conta_azul_category_id: id,
                                      conta_azul_category_name: name,
                                    })
                                  }
                                  placeholder="Selecionar categoria..."
                                  disabled={fieldsDisabled}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center h-8 px-2 text-xs rounded-md border bg-muted/40 text-muted-foreground gap-1">
                                  <span className="truncate">{row.conta_azul_account_name || "Flash"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  {statusBadge(row.status)}
                                  {row.flash_prestacao_contas && row.flash_prestacao_contas !== "—" && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                                      {row.flash_prestacao_contas}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{renderActionButtons(row)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between space-x-2 py-4 border-t mt-4">
                      <div className="text-sm text-muted-foreground">
                        Mostrando <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filtered.length)}</strong> de <strong>{filtered.length}</strong> lançamentos
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        <div className="flex items-center gap-1 text-sm font-medium">
                          Página {currentPage} de {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Próximo
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pendentes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Revisão em lote — Pendentes</CardTitle>
              <p className="text-xs text-muted-foreground">
                Selecione lançamentos pendentes e aplique categoria, conta e operação a todos de uma vez.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Categoria CA</label>
                  <OptionSelect
                    options={categorias}
                    value={bulkCat?.id || null}
                    onChange={(id, name) => setBulkCat({ id, name })}
                    placeholder="Selecionar..."
                    disabled={loadingMetadata}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Conta financeira CA</label>
                  <OptionSelect
                    options={contas}
                    value={bulkAcc?.id || null}
                    onChange={(id, name) => setBulkAcc({ id, name })}
                    placeholder="Selecionar..."
                    disabled={loadingMetadata}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Operação</label>
                  <Select value={bulkTipo} onValueChange={(v) => setBulkTipo(v as "receita" | "despesa")}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa" className="text-xs">Despesa</SelectItem>
                      <SelectItem value="receita" className="text-xs">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={bulkSaveMapping}
                      onCheckedChange={(c) => setBulkSaveMapping(!!c)}
                    />
                    Salvar mapeamento por tipo
                  </label>
                  <Button
                    size="sm"
                    onClick={handleBulkApply}
                    disabled={
                      bulkApplying ||
                      !bulkCat ||
                      !bulkAcc ||
                      selectedPendingIds.length === 0
                    }
                  >
                    {bulkApplying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Aplicar a {selectedPendingIds.length} selecionado(s)
                  </Button>
                </div>
              </div>

              {pendentes.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum lançamento pendente. ✨
                </div>
              ) : (
                <TooltipProvider delayDuration={200}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allPendingSelected}
                              onCheckedChange={(c) => togglePendingAll(!!c)}
                            />
                          </TableHead>
                          <TableHead className="w-[90px]">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[110px] text-right">Valor</TableHead>
                          <TableHead className="w-[120px]">Tipo Flash</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead className="w-[80px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendentes.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPendingIds.includes(row.id)}
                                onCheckedChange={(c) => togglePendingSelect(row.id, !!c)}
                              />
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(row.data)}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate">
                              {row.descricao}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {formatCurrency(row.valor)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {row.flash_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground max-w-[300px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate">{row.motivo || "—"}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs break-words">{row.motivo || "Sem motivo registrado."}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setMotivoDialogRow(row)}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapeamentos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mapeamentos automáticos por tipo Flash</CardTitle>
              <p className="text-xs text-muted-foreground">
                Estes mapeamentos preenchem automaticamente novos lançamentos do mesmo tipo.
              </p>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum mapeamento salvo ainda. Salve uma normalização na tabela acima para criar um.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo Flash</TableHead>
                      <TableHead>Categoria Flash</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Categoria Conta Azul</TableHead>
                      <TableHead>Conta financeira CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {m.flash_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {m.flash_category ? (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                              {m.flash_category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">Todos</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{m.tipo_operacao}</TableCell>
                        <TableCell className="text-xs">{m.conta_azul_category_name || "—"}</TableCell>
                        <TableCell className="text-xs">{m.conta_azul_account_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Payload pronto */}
      <Dialog open={!!payloadDialogRow} onOpenChange={(o) => !o && setPayloadDialogRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload pronto para o Conta Azul</DialogTitle>
            <DialogDescription>
              Visualização exata do JSON que será enviado quando esta transação for sincronizada. Nada é enviado agora.
            </DialogDescription>
          </DialogHeader>
          {payloadDialogRow && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  {statusBadge(payloadDialogRow.status)}
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo Flash: </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {payloadDialogRow.flash_type}
                  </Badge>
                </div>
              </div>
              {payloadDialogRow.conta_azul_payload ? (
                <pre className="bg-muted rounded-md p-3 text-[11px] overflow-auto max-h-[400px] font-mono">
{JSON.stringify(payloadDialogRow.conta_azul_payload, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground bg-amber-500/5 border border-amber-500/30 rounded p-3">
                  ⚠ Payload ainda não disponível — defina categoria e conta financeira para gerar.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayloadDialogRow(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog: Motivo da normalização */}
      <Dialog open={!!motivoDialogRow} onOpenChange={(o) => !o && setMotivoDialogRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da normalização</DialogTitle>
            <DialogDescription>
              Por que esta transação está {statusBadge(motivoDialogRow?.status)}?
            </DialogDescription>
          </DialogHeader>
          {motivoDialogRow && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tipo Flash detectado</p>
                <Badge variant="secondary" className="text-xs">
                  {motivoDialogRow.flash_type_detectado || motivoDialogRow.flash_type}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mapping usado</p>
                <p className="text-xs">
                  {motivoDialogRow.mapping_id_usado ? (
                    <span className="font-mono break-all">{motivoDialogRow.mapping_id_usado}</span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum mapping aplicado</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="text-sm bg-muted rounded p-3 whitespace-pre-wrap">
                  {motivoDialogRow.motivo || "Sem motivo registrado."}
                </p>
              </div>
              {motivoDialogRow.enviado_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Enviado em</p>
                  <p className="text-xs">{new Date(motivoDialogRow.enviado_at).toLocaleString("pt-BR")}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotivoDialogRow(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm reabrir enviado */}
      <AlertDialog open={!!confirmReopenRow} onOpenChange={(o) => !o && setConfirmReopenRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir lançamento enviado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta transação está marcada como <strong>Enviado</strong>. Reabrir vai mudar o status para
              "Normalizado" e permitir alterações em categoria, conta e operação. Use isto para
              correções posteriores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmReopenRow) {
                  await reopenEnviado(confirmReopenRow);
                  setConfirmReopenRow(null);
                }
              }}
            >
              Reabrir para correção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
