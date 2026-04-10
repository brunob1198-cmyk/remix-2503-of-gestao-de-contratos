import { useState, useMemo } from "react";
import { useItensDisponiveis, useFaturamentos, useGerarFaturamento, useUpdateFaturamentoStatus, ItemDisponivel, FaturamentoItem } from "@/hooks/useFaturamento";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useMunicipios } from "@/hooks/useMunicipios";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, FileDown, Loader2, Receipt, CheckCircle2, Clock, Ban, Filter, X, FilterX, MapPin, Pencil } from "lucide-react";
import { format } from "date-fns";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  emitido: { label: "Emitido", color: "bg-yellow-500", icon: <Clock className="h-3 w-3" /> },
  pago: { label: "Pago", color: "bg-green-500", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", color: "bg-red-500", icon: <Ban className="h-3 w-3" /> },
};

export default function FaturamentoPage() {
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjetoIds, setSelectedProjetoIds] = usePersistedState<string[]>("faturamento_projeto_ids", []);
  const [projetoSearch, setProjetoSearch] = useState("");
  const activeProjetoIds = selectedProjetoIds.length > 0 ? selectedProjetoIds : undefined;
  const { data: itensDisponiveis = [], isLoading: loadingItens } = useItensDisponiveis(activeProjetoIds);
  const { data: faturamentos = [], isLoading: loadingFaturas } = useFaturamentos(activeProjetoIds);
  const gerarFaturamento = useGerarFaturamento();
  const updateStatus = useUpdateFaturamentoStatus();

  // Filters state
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [siteSearch, setSiteSearch] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Municipality edit state
  const [editMunicipioSiteId, setEditMunicipioSiteId] = useState<string | null>(null);
  const [editUf, setEditUf] = useState("");
  const [editMunicipio, setEditMunicipio] = useState("");
  const [savingMunicipio, setSavingMunicipio] = useState(false);

  // Load municipios for selected UF
  const { municipios: municipiosFiltrados, UF_LIST: ufs } = useMunicipios(editUf || undefined);

  // Pagination for Gerar Fatura tab
  const [gerarPage, setGerarPage] = useState(1);
  const [gerarPageSize, setGerarPageSize] = useState(20);

  // State for invoice creation
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [impostosPerc, setImpostosPerc] = useState(0);
  const [descontos, setDescontos] = useState(0);
  const [observacao, setObservacao] = useState("");
  const [numeroFatura, setNumeroFatura] = useState("");

  // Municipality save handler
  const handleSaveMunicipio = async () => {
    if (!editMunicipioSiteId || !editUf || !editMunicipio) return;
    setSavingMunicipio(true);
    try {
      const { error } = await supabase
        .from("sites")
        .update({ uf: editUf, municipio: editMunicipio })
        .eq("id", editMunicipioSiteId);
      if (error) throw error;
      toast({ title: "Município atualizado com sucesso!" });
      setEditMunicipioSiteId(null);
      queryClient.invalidateQueries({ queryKey: ["itens_disponiveis_faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar município", description: err.message, variant: "destructive" });
    } finally {
      setSavingMunicipio(false);
    }
  };

  // Group items by project for display
  const projetoSelecionado = selectedProjetoIds.length === 1 ? projetos.find(p => p.id === selectedProjetoIds[0]) : null;
  const projetoSites = sites.filter(s => selectedProjetoIds.length === 0 || selectedProjetoIds.includes(s.projeto_id));

  // Filtered lists
  const filteredItens = useMemo(() => {
    return itensDisponiveis.filter(item => {
      if (selectedSites.size > 0 && !selectedSites.has(item.site_id)) return false;
      return true;
    });
  }, [itensDisponiveis, selectedSites]);

  // Group filtered items by projeto + numero_medicao + municipality
  const groupedByMunicipio = useMemo(() => {
    const groups = new Map<string, { uf: string; municipio: string; projeto_codigo: string; numero_medicao: string; items: ItemDisponivel[] }>();
    filteredItens.forEach(item => {
      const muniLabel = item.site_municipio && item.site_uf
        ? `${item.site_municipio} - ${item.site_uf}`
        : "Sem município definido";
      const mKey = `${item.projeto_id}__${item.numero_medicao}__${muniLabel}`;
      if (!groups.has(mKey)) {
        groups.set(mKey, { uf: item.site_uf || "", municipio: item.site_municipio || "", projeto_codigo: item.projeto_codigo, numero_medicao: item.numero_medicao, items: [] });
      }
      groups.get(mKey)!.items.push(item);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      // Sort by projeto, then medicao, then municipio
      const cmp1 = a[1].projeto_codigo.localeCompare(b[1].projeto_codigo);
      if (cmp1 !== 0) return cmp1;
      const cmp2 = a[1].numero_medicao.localeCompare(b[1].numero_medicao);
      if (cmp2 !== 0) return cmp2;
      if (a[0].includes("Sem município")) return 1;
      if (b[0].includes("Sem município")) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredItens]);

  // Paginate flat items list, then derive which groups to show
  const totalGerarItems = filteredItens.length;
  const totalGerarPages = Math.max(1, Math.ceil(totalGerarItems / gerarPageSize));
  const safeGerarPage = Math.min(gerarPage, totalGerarPages);

  const paginatedGroups = useMemo(() => {
    const allItemsOrdered: { groupKey: string; item: ItemDisponivel }[] = [];
    for (const [key, group] of groupedByMunicipio) {
      for (const item of group.items) {
        allItemsOrdered.push({ groupKey: key, item });
      }
    }
    const start = (safeGerarPage - 1) * gerarPageSize;
    const pageItems = allItemsOrdered.slice(start, start + gerarPageSize);

    const result: [string, { uf: string; municipio: string; projeto_codigo: string; numero_medicao: string; items: ItemDisponivel[] }][] = [];
    const groupMap = new Map<string, ItemDisponivel[]>();
    for (const { groupKey, item } of pageItems) {
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
      groupMap.get(groupKey)!.push(item);
    }
    for (const [key, items] of groupMap) {
      const orig = groupedByMunicipio.find(([k]) => k === key);
      if (orig) {
        result.push([key, { ...orig[1], items }]);
      }
    }
    return result;
  }, [groupedByMunicipio, safeGerarPage, gerarPageSize]);

  const filteredFaturamentos = useMemo(() => {
    return faturamentos.filter(fat => {
      if (dataInicio && fat.data_emissao < dataInicio) return false;
      if (dataFim && fat.data_emissao > dataFim) return false;
      
      if (selectedSites.size > 0) {
        if (!fat.itens || fat.itens.length === 0) return false;
        const fatSiteIds = (fat.itens || []).map(i => i.site_id);
        const hasMatch = fatSiteIds.some(sid => selectedSites.has(sid));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [faturamentos, dataInicio, dataFim, selectedSites]);

  const columnsItens = ["projeto", "medicao", "site", "item", "unidade", "aprovado", "faturado", "saldo"] as const;
  const getColValueItem = (item: ItemDisponivel, col: typeof columnsItens[number]): string => {
    if (col === "projeto") return item.projeto_codigo || "";
    if (col === "medicao") return item.numero_medicao || "";
    if (col === "site") return item.site_codigo || "";
    if (col === "item") return `${item.item_codigo} ${item.item_descricao}`;
    if (col === "unidade") return item.unidade || "";
    if (col === "aprovado") return item.valor_aprovado.toString();
    if (col === "faturado") return item.valor_ja_faturado.toString();
    if (col === "saldo") return item.valor_saldo.toString();
    return "";
  };

  // Helper to get municipality from faturamento items via sites
  const getFaturamentoMunicipio = (f: any): string => {
    const itens = f.itens as FaturamentoItem[] | undefined;
    if (!itens || itens.length === 0) return "";
    const municipios = new Set<string>();
    for (const item of itens) {
      const site = sites.find(s => s.id === item.site_id);
      if (site?.municipio) municipios.add(site.municipio);
    }
    return Array.from(municipios).join(", ");
  };

  const columnsFaturas = ["numero", "data", "projeto", "municipio", "bruto", "impostos", "descontos", "liquido", "status"] as const;
  const getColValueFatura = (f: any, col: typeof columnsFaturas[number]): string => {
    if (col === "numero") return f.numero_fatura || "";
    if (col === "data") return format(new Date(f.data_emissao + "T12:00:00"), "dd/MM/yyyy");
    if (col === "projeto") return (f.projeto as any)?.codigo || "";
    if (col === "municipio") return getFaturamentoMunicipio(f);
    if (col === "bruto") return f.valor_bruto.toString();
    if (col === "impostos") return f.impostos_valor.toString();
    if (col === "descontos") return f.descontos.toString();
    if (col === "liquido") return f.valor_liquido.toString();
    if (col === "status") return STATUS_MAP[f.status]?.label || "";
    return "";
  };

  const tableItens = useTableFilters(filteredItens, columnsItens, getColValueItem);
  const tableFaturas = useTableFilters(filteredFaturamentos, columnsFaturas, getColValueFatura);

  const toggleItem = (key: string, item: ItemDisponivel) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Check if trying to mix projects
        const selectedProjIds = new Set<string>();
        for (const [k] of next) {
          const matchItem = filteredItens.find(i => `${i.site_id}__${i.item_lpu_id}__${i.numero_medicao}` === k);
          if (matchItem) selectedProjIds.add(matchItem.projeto_id);
        }
        if (selectedProjIds.size > 0 && !selectedProjIds.has(item.projeto_id)) {
          toast({ title: "Medições de projetos diferentes não podem ser faturadas juntas", variant: "destructive" });
          return prev;
        }
        next.set(key, item.valor_saldo);
      }
      return next;
    });
  };

  const setItemValue = (key: string, valor: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.set(key, valor);
      return next;
    });
  };

  const selectAll = () => {
    const next = new Map<string, number>();
    // Only select items from the first project found
    const firstProjId = tableItens.processedItems[0]?.projeto_id;
    tableItens.processedItems.forEach(item => {
      if (item.projeto_id !== firstProjId) return;
      const key = `${item.site_id}__${item.item_lpu_id}__${item.numero_medicao}`;
      next.set(key, item.valor_saldo);
    });
    if (tableItens.processedItems.some(i => i.projeto_id !== firstProjId)) {
      toast({ title: "Apenas itens do mesmo projeto foram selecionados", description: "Medições de projetos diferentes não podem ser faturadas juntas." });
    }
    setSelectedItems(next);
  };

  const deselectAll = () => setSelectedItems(new Map());

  // Totals
  const totalAprovado = tableItens.processedItems.reduce((s, i) => s + i.valor_aprovado, 0);
  const totalJaFaturado = tableItens.processedItems.reduce((s, i) => s + i.valor_ja_faturado, 0);
  const totalDisponivel = tableItens.processedItems.reduce((s, i) => s + i.valor_saldo, 0);

  const valorBrutoFatura = Array.from(selectedItems.values()).reduce((s, v) => s + v, 0);
  const impostosValor = valorBrutoFatura * (impostosPerc / 100);
  const valorLiquido = valorBrutoFatura - impostosValor - descontos;

  // Summary for all projects (histórico)
  const totalFaturadoHist = tableFaturas.processedItems.reduce((s, f) => s + f.valor_bruto, 0);
  const totalLiquidoHist = tableFaturas.processedItems.reduce((s, f) => s + f.valor_liquido, 0);

  const handleGerar = () => {
    // Determine project from selected items
    const selectedItemsList = itensDisponiveis.filter(item => selectedItems.has(`${item.site_id}__${item.item_lpu_id}__${item.numero_medicao}`));
    if (selectedItemsList.length === 0) return;
    
    // Group by projeto_id - generate one fatura per project
    const byProjeto = new Map<string, typeof selectedItemsList>();
    selectedItemsList.forEach(item => {
      const pid = item.projeto_id;
      if (!byProjeto.has(pid)) byProjeto.set(pid, []);
      byProjeto.get(pid)!.push(item);
    });

    for (const [pid, items] of byProjeto) {
      const itens = items.map(item => {
        const key = `${item.site_id}__${item.item_lpu_id}__${item.numero_medicao}`;
        const valorFaturar = selectedItems.get(key) || 0;
        const qtdFaturar = item.preco_unitario > 0 ? valorFaturar / item.preco_unitario : 0;
        return {
          site_id: item.site_id,
          item_lpu_id: item.item_lpu_id,
          quantidade_faturada: qtdFaturar,
          valor_unitario: item.preco_unitario,
          valor_faturado: valorFaturar,
        };
      }).filter(i => i.valor_faturado > 0);

      if (itens.length === 0) continue;

      gerarFaturamento.mutate({
        projeto_id: pid,
      numero_fatura: numeroFatura || undefined,
      data_emissao: dataEmissao,
      impostos_percentual: impostosPerc,
      descontos,
      observacao: observacao || undefined,
      itens,
    }, {
      onSuccess: () => {
        setSelectedItems(new Map());
        setNumeroFatura("");
        setObservacao("");
        setImpostosPerc(0);
        setDescontos(0);
      }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" /> Portal de Faturamento
        </h1>
        <p className="text-muted-foreground">Transforme medições aprovadas em faturamento com rastreabilidade total</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex-1 min-w-[250px]">
              <Label>Selecione o(s) Projeto(s)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-between w-full ${selectedProjetoIds.length > 0 ? "border-primary" : ""}`}>
                    <span className="truncate">
                      {selectedProjetoIds.length === 0
                        ? "Todos os projetos"
                        : selectedProjetoIds.length === 1
                          ? (() => { const p = projetos.find(x => x.id === selectedProjetoIds[0]); return p ? `${p.codigo} - ${p.nome}` : "1 projeto"; })()
                          : `${selectedProjetoIds.length} projetos selecionados`}
                    </span>
                    <Filter className="h-4 w-4 ml-2 opacity-50 flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-3" align="start">
                  <Input
                    placeholder="Buscar projeto..."
                    value={projetoSearch}
                    onChange={(e) => setProjetoSearch(e.target.value)}
                    className="h-8 mb-2"
                  />
                  <div className="flex gap-2 text-xs mb-2">
                    <button onClick={() => setSelectedProjetoIds(projetos.map(p => p.id))} className="text-primary hover:underline">Todos</button>
                    <button onClick={() => { setSelectedProjetoIds([]); setSelectedItems(new Map()); setSelectedSites(new Set()); }} className="text-primary hover:underline">Limpar</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {projetos
                      .filter(p => `${p.codigo} ${p.nome}`.toLowerCase().includes(projetoSearch.toLowerCase()))
                      .map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-1">
                          <Checkbox
                            checked={selectedProjetoIds.includes(p.id)}
                            onCheckedChange={(checked) => {
                              setSelectedProjetoIds(prev => {
                                if (checked) return [...prev, p.id];
                                return prev.filter(id => id !== p.id);
                              });
                              setSelectedItems(new Map());
                            }}
                          />
                          <span className="truncate">{p.codigo} - {p.nome}</span>
                        </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-1">
              <Label>Filtrar por Sites</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`justify-between w-full md:w-[280px] ${selectedSites.size > 0 ? "border-primary" : ""}`}>
                        <span className="truncate">
                          {selectedSites.size > 0 ? `${selectedSites.size} site(s) selecionado(s)` : "Todos os sites"}
                        </span>
                        <Filter className="h-4 w-4 ml-2 opacity-50 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-3" align="start">
                      <Input
                        placeholder="Buscar site..."
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                        className="h-8 mb-2"
                      />
                      <div className="flex gap-2 text-xs mb-2">
                        <button onClick={() => setSelectedSites(new Set(projetoSites.map(s => s.id)))} className="text-primary hover:underline">Todos</button>
                        <button onClick={() => setSelectedSites(new Set())} className="text-primary hover:underline">Limpar</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {projetoSites
                          .filter(s => s.nome.toLowerCase().includes(siteSearch.toLowerCase()) || s.codigo.toLowerCase().includes(siteSearch.toLowerCase()))
                          .map(s => (
                            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-1">
                              <Checkbox
                                checked={selectedSites.has(s.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedSites(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(s.id); else next.delete(s.id);
                                    return next;
                                  });
                                }}
                              />
                              <span className="truncate">{s.codigo} - {s.nome}</span>
                            </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-full md:w-auto flex flex-col gap-1">
                  <Label>Período (Faturas)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[130px]" />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[130px]" />
                    {(dataInicio || dataFim || selectedSites.size > 0) && (
                      <Button variant="ghost" size="icon" onClick={() => { setDataInicio(""); setDataFim(""); setSelectedSites(new Set()); }} title="Limpar Filtros">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
          </div>
        </CardContent>
      </Card>

      {(selectedProjetoIds.length > 0 || projetos.length > 0) && (
        <Tabs defaultValue="gerar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="gerar">
              <Receipt className="h-4 w-4 mr-2" /> Gerar Fatura
            </TabsTrigger>
            <TabsTrigger value="historico">
              <FileDown className="h-4 w-4 mr-2" /> Histórico de Faturas
            </TabsTrigger>
          </TabsList>

          {/* TAB: GERAR FATURA */}
          <TabsContent value="gerar" className="space-y-4">
            {/* Resumo cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Aprovado Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(totalAprovado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Já Faturado</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(totalJaFaturado)}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-700">Disponível para Faturar</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(totalDisponivel)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Items disponíveis */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Itens Disponíveis para Faturar</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Selecionar Todos</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>Limpar</Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingItens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredItens.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum item aprovado disponível para os filtros selecionados.
                  </p>
                ) : (
                  <>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            {tableItens.hasActiveFilters && (
                              <Button variant="ghost" size="icon" onClick={tableItens.clearAllFilters} title="Limpar filtros da tabela">
                                <FilterX className="h-4 w-4" />
                              </Button>
                            )}
                          </TableHead>
                          <TableHead>
                            <ColumnHeader label="Projeto" sortDir={tableItens.sortColumn === "projeto" ? tableItens.sortDir : null} onSort={() => tableItens.handleSort("projeto")} searchText={tableItens.searchTexts["projeto"]} onSearchChange={(v) => tableItens.setSearchText("projeto", v)} uniqueValues={tableItens.uniqueValues["projeto"]} selectedValues={tableItens.selectedFilters["projeto"]} onToggleValue={(v) => tableItens.toggleValue("projeto", v)} onSelectAll={() => tableItens.selectAll("projeto", tableItens.uniqueValues["projeto"])} onClearAll={() => tableItens.clearAll("projeto")} />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader label="Medição" sortDir={tableItens.sortColumn === "medicao" ? tableItens.sortDir : null} onSort={() => tableItens.handleSort("medicao")} searchText={tableItens.searchTexts["medicao"]} onSearchChange={(v) => tableItens.setSearchText("medicao", v)} uniqueValues={tableItens.uniqueValues["medicao"]} selectedValues={tableItens.selectedFilters["medicao"]} onToggleValue={(v) => tableItens.toggleValue("medicao", v)} onSelectAll={() => tableItens.selectAll("medicao", tableItens.uniqueValues["medicao"])} onClearAll={() => tableItens.clearAll("medicao")} />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader label="Site" sortDir={tableItens.sortColumn === "site" ? tableItens.sortDir : null} onSort={() => tableItens.handleSort("site")} searchText={tableItens.searchTexts["site"]} onSearchChange={(v) => tableItens.setSearchText("site", v)} uniqueValues={tableItens.uniqueValues["site"]} selectedValues={tableItens.selectedFilters["site"]} onToggleValue={(v) => tableItens.toggleValue("site", v)} onSelectAll={() => tableItens.selectAll("site", tableItens.uniqueValues["site"])} onClearAll={() => tableItens.clearAll("site")} />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader label="Item" sortDir={tableItens.sortColumn === "item" ? tableItens.sortDir : null} onSort={() => tableItens.handleSort("item")} searchText={tableItens.searchTexts["item"]} onSearchChange={(v) => tableItens.setSearchText("item", v)} uniqueValues={tableItens.uniqueValues["item"]} selectedValues={tableItens.selectedFilters["item"]} onToggleValue={(v) => tableItens.toggleValue("item", v)} onSelectAll={() => tableItens.selectAll("item", tableItens.uniqueValues["item"])} onClearAll={() => tableItens.clearAll("item")} />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader label="Unid." sortDir={tableItens.sortColumn === "unidade" ? tableItens.sortDir : null} onSort={() => tableItens.handleSort("unidade")} searchText={tableItens.searchTexts["unidade"]} onSearchChange={(v) => tableItens.setSearchText("unidade", v)} uniqueValues={tableItens.uniqueValues["unidade"]} selectedValues={tableItens.selectedFilters["unidade"]} onToggleValue={(v) => tableItens.toggleValue("unidade", v)} onSelectAll={() => tableItens.selectAll("unidade", tableItens.uniqueValues["unidade"])} onClearAll={() => tableItens.clearAll("unidade")} />
                          </TableHead>
                          <TableHead className="text-right">Aprovado</TableHead>
                          <TableHead className="text-right">Já Faturado</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right w-44">Valor a Faturar</TableHead>
                        </TableRow>
                      </TableHeader>
              </CardContent>
            </Card>

            {/* Configuração da fatura */}
            {selectedItems.size > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuração da Fatura</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nº da Fatura</Label>
                        <Input
                          value={numeroFatura}
                          onChange={e => setNumeroFatura(e.target.value)}
                          placeholder="Ex: NF-001"
                        />
                      </div>
                      <div>
                        <Label>Data de Emissão</Label>
                        <Input
                          type="date"
                          value={dataEmissao}
                          onChange={e => setDataEmissao(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Impostos (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={impostosPerc}
                          onChange={e => setImpostosPerc(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Descontos (R$)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={descontos}
                          onChange={e => setDescontos(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Informações adicionais..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo da Fatura</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span>Valor bruto:</span>
                      <span className="font-semibold">{formatCurrency(valorBrutoFatura)}</span>
                    </div>
                    {impostosPerc > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Impostos ({impostosPerc}%):</span>
                        <span>- {formatCurrency(impostosValor)}</span>
                      </div>
                    )}
                    {descontos > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Descontos:</span>
                        <span>- {formatCurrency(descontos)}</span>
                      </div>
                    )}
                    <hr />
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total líquido:</span>
                      <span className="text-green-700">{formatCurrency(valorLiquido)}</span>
                    </div>

                    <Button
                      className="w-full mt-4"
                      size="lg"
                      onClick={handleGerar}
                      disabled={gerarFaturamento.isPending || valorBrutoFatura <= 0}
                    >
                      {gerarFaturamento.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <DollarSign className="h-4 w-4 mr-2" />
                      )}
                      Gerar Faturamento
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* TAB: HISTÓRICO */}
          <TabsContent value="historico" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Faturado (bruto)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(totalFaturadoHist)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Líquido</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(totalLiquidoHist)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Faturas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFaturas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredFaturamentos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma fatura encontrada com os filtros selecionados.</p>
                ) : (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              {tableFaturas.hasActiveFilters && (
                                <Button variant="ghost" size="icon" onClick={tableFaturas.clearAllFilters} title="Limpar filtros da tabela">
                                  <FilterX className="h-4 w-4" />
                                </Button>
                              )}
                              <ColumnHeader
                                label="Nº Fatura"
                                sortDir={tableFaturas.sortColumn === "numero" ? tableFaturas.sortDir : null}
                                onSort={() => tableFaturas.handleSort("numero")}
                                searchText={tableFaturas.searchTexts["numero"]}
                                onSearchChange={(v) => tableFaturas.setSearchText("numero", v)}
                                uniqueValues={tableFaturas.uniqueValues["numero"]}
                                selectedValues={tableFaturas.selectedFilters["numero"]}
                                onToggleValue={(v) => tableFaturas.toggleValue("numero", v)}
                                onSelectAll={() => tableFaturas.selectAll("numero", tableFaturas.uniqueValues["numero"])}
                                onClearAll={() => tableFaturas.clearAll("numero")}
                              />
                            </div>
                          </TableHead>
                          <TableHead>
                            <ColumnHeader
                              label="Data Emissão"
                              sortDir={tableFaturas.sortColumn === "data" ? tableFaturas.sortDir : null}
                              onSort={() => tableFaturas.handleSort("data")}
                              searchText={tableFaturas.searchTexts["data"]}
                              onSearchChange={(v) => tableFaturas.setSearchText("data", v)}
                              uniqueValues={tableFaturas.uniqueValues["data"]}
                              selectedValues={tableFaturas.selectedFilters["data"]}
                              onToggleValue={(v) => tableFaturas.toggleValue("data", v)}
                              onSelectAll={() => tableFaturas.selectAll("data", tableFaturas.uniqueValues["data"])}
                              onClearAll={() => tableFaturas.clearAll("data")}
                            />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader
                              label="Projeto"
                              sortDir={tableFaturas.sortColumn === "projeto" ? tableFaturas.sortDir : null}
                              onSort={() => tableFaturas.handleSort("projeto")}
                              searchText={tableFaturas.searchTexts["projeto"]}
                              onSearchChange={(v) => tableFaturas.setSearchText("projeto", v)}
                              uniqueValues={tableFaturas.uniqueValues["projeto"]}
                              selectedValues={tableFaturas.selectedFilters["projeto"]}
                              onToggleValue={(v) => tableFaturas.toggleValue("projeto", v)}
                              onSelectAll={() => tableFaturas.selectAll("projeto", tableFaturas.uniqueValues["projeto"])}
                              onClearAll={() => tableFaturas.clearAll("projeto")}
                            />
                          </TableHead>
                          <TableHead>
                            <ColumnHeader
                              label="Município"
                              sortDir={tableFaturas.sortColumn === "municipio" ? tableFaturas.sortDir : null}
                              onSort={() => tableFaturas.handleSort("municipio")}
                              searchText={tableFaturas.searchTexts["municipio"]}
                              onSearchChange={(v) => tableFaturas.setSearchText("municipio", v)}
                              uniqueValues={tableFaturas.uniqueValues["municipio"]}
                              selectedValues={tableFaturas.selectedFilters["municipio"]}
                              onToggleValue={(v) => tableFaturas.toggleValue("municipio", v)}
                              onSelectAll={() => tableFaturas.selectAll("municipio", tableFaturas.uniqueValues["municipio"])}
                              onClearAll={() => tableFaturas.clearAll("municipio")}
                            />
                          </TableHead>
                          <TableHead className="text-right">Valor Bruto</TableHead>
                          <TableHead className="text-right">Impostos</TableHead>
                          <TableHead className="text-right">Descontos</TableHead>
                          <TableHead className="text-right">Valor Líquido</TableHead>
                          <TableHead>
                            <ColumnHeader
                              label="Status"
                              sortDir={tableFaturas.sortColumn === "status" ? tableFaturas.sortDir : null}
                              onSort={() => tableFaturas.handleSort("status")}
                              searchText={tableFaturas.searchTexts["status"]}
                              onSearchChange={(v) => tableFaturas.setSearchText("status", v)}
                              uniqueValues={tableFaturas.uniqueValues["status"]}
                              selectedValues={tableFaturas.selectedFilters["status"]}
                              onToggleValue={(v) => tableFaturas.toggleValue("status", v)}
                              onSelectAll={() => tableFaturas.selectAll("status", tableFaturas.uniqueValues["status"])}
                              onClearAll={() => tableFaturas.clearAll("status")}
                            />
                          </TableHead>
                          <TableHead className="w-28">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableFaturas.paginatedItems.map(f => {
                          const st = STATUS_MAP[f.status] || STATUS_MAP.emitido;
                          return (
                            <TableRow key={f.id}>
                              <TableCell className="font-medium">{f.numero_fatura || "—"}</TableCell>
                              <TableCell>{format(new Date(f.data_emissao + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                              <TableCell>{(f.projeto as any)?.codigo || ""}</TableCell>
                              <TableCell>{getFaturamentoMunicipio(f)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(f.valor_bruto)}</TableCell>
                              <TableCell className="text-right text-destructive">
                                {f.impostos_valor > 0 ? `- ${formatCurrency(f.impostos_valor)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {f.descontos > 0 ? `- ${formatCurrency(f.descontos)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(f.valor_liquido)}</TableCell>
                              <TableCell>
                                <Badge className={`${st.color} text-white flex items-center gap-1 w-fit`}>
                                  {st.icon} {st.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={f.status}
                                  onValueChange={v => updateStatus.mutate({ id: f.id, status: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="emitido">Emitido</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  )}
                  {!loadingFaturas && tableFaturas.processedItems.length > 0 && (
                    <TablePagination
                      currentPage={tableFaturas.currentPage}
                      totalPages={tableFaturas.totalPages}
                      onPageChange={tableFaturas.setCurrentPage}
                      itemsPerPage={tableFaturas.itemsPerPage}
                      onItemsPerPageChange={tableFaturas.setItemsPerPage}
                      totalItems={tableFaturas.processedItems.length}
                    />
                  )}

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}
