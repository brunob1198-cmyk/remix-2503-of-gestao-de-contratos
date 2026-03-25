import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

interface LancamentosTableProps {
  titulo: string;
  lancamentos: any[];
  tipo: "producao" | "medicao" | "faturamento";
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

type SortField = "data" | "projeto" | "site" | "item" | "quantidade" | "valor" | "extra";
type SortDirection = "asc" | "desc";

export function LancamentosTable({ titulo, lancamentos, tipo, isLoading, onDelete, onBulkDelete }: LancamentosTableProps) {
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [projetoFilter, setProjetoFilter] = useState<string>("");
  const [itemFilter, setItemFilter] = useState<string>("");
  const [selectedMedicoes, setSelectedMedicoes] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return parseLocalDate(dateStr).toLocaleDateString("pt-BR");
  };

  const getDataField = () => {
    switch (tipo) {
      case "producao": return "data_producao";
      case "medicao": return "data_medicao";
      case "faturamento": return "data_faturamento";
    }
  };

  const getExtraColumn = () => {
    switch (tipo) {
      case "producao": return { label: "Empresa", field: "empresa_executora" };
      case "medicao": return { label: "Nº Medição", field: "numero_medicao" };
      case "faturamento": return { label: "Nº NF", field: "numero_nf" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enviada":
        return <Badge variant="secondary">Enviada</Badge>;
      case "aprovado":
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Aprovada</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitada</Badge>;
      case "pendente":
        return <Badge variant="outline">Pendente</Badge>;
      case "finalizado":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Finalizado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const extraCol = getExtraColumn();
  const dataField = getDataField();

  // Get unique sites for filter dropdown
  const uniqueSites = useMemo(() => {
    const sitesMap = new Map();
    lancamentos.forEach(l => {
      if (l.site) {
        sitesMap.set(l.site.id, { codigo: l.site.codigo, nome: l.site.nome });
      }
    });
    return Array.from(sitesMap.entries()).map(([id, site]) => ({ id, ...site }));
  }, [lancamentos]);

  // Get unique projects for filter dropdown
  const uniqueProjetos = useMemo(() => {
    const projetosMap = new Map();
    lancamentos.forEach(l => {
      if (l.site?.projeto) {
        projetosMap.set(l.site.projeto.id, { codigo: l.site.projeto.codigo, nome: l.site.projeto.nome });
      }
    });
    return Array.from(projetosMap.entries()).map(([id, projeto]) => ({ id, ...projeto }));
  }, [lancamentos]);

  // Get unique measurement numbers for filter dropdown (medicao only)
  const uniqueMedicoes = useMemo(() => {
    if (tipo !== "medicao") return [];
    const medicoesSet = new Set<string>();
    lancamentos.forEach(l => {
      if (l.numero_medicao) {
        medicoesSet.add(l.numero_medicao);
      }
    });
    return Array.from(medicoesSet).sort();
  }, [lancamentos, tipo]);

  const handleMedicaoToggle = (medicao: string) => {
    setSelectedMedicoes(prev => 
      prev.includes(medicao) 
        ? prev.filter(m => m !== medicao)
        : [...prev, medicao]
    );
  };

  const handleSelectAllMedicoes = () => {
    if (selectedMedicoes.length === uniqueMedicoes.length) {
      setSelectedMedicoes([]);
    } else {
      setSelectedMedicoes([...uniqueMedicoes]);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedLancamentos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedLancamentos.map(l => l.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length > 0 && onBulkDelete) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Filter and sort lancamentos
  const filteredAndSortedLancamentos = useMemo(() => {
    let filtered = [...lancamentos];

    // Apply filters
    if (siteFilter) {
      filtered = filtered.filter(l => l.site?.id === siteFilter);
    }
    if (projetoFilter) {
      filtered = filtered.filter(l => l.site?.projeto?.id === projetoFilter);
    }
    if (itemFilter) {
      const term = itemFilter.toLowerCase();
      filtered = filtered.filter(l => 
        l.item_lpu?.codigo?.toLowerCase().includes(term) ||
        l.item_lpu?.descricao?.toLowerCase().includes(term)
      );
    }
    // Filter by measurement numbers (medicao only)
    if (tipo === "medicao" && selectedMedicoes.length > 0) {
      filtered = filtered.filter(l => selectedMedicoes.includes(l.numero_medicao || ""));
    }

    // Sort
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (sortField) {
        case "data":
          valueA = a[dataField];
          valueB = b[dataField];
          break;
        case "projeto":
          valueA = a.site?.projeto?.codigo || "";
          valueB = b.site?.projeto?.codigo || "";
          break;
        case "site":
          valueA = a.site?.codigo || "";
          valueB = b.site?.codigo || "";
          break;
        case "item":
          valueA = a.item_lpu?.codigo || "";
          valueB = b.item_lpu?.codigo || "";
          break;
        case "quantidade":
          valueA = Number(a.quantidade);
          valueB = Number(b.quantidade);
          break;
        case "valor":
          const precoA = Number(a.item_lpu?.preco_unitario || 0);
          const precoB = Number(b.item_lpu?.preco_unitario || 0);
          valueA = tipo === "faturamento" && a.valor_faturado ? Number(a.valor_faturado) : Number(a.quantidade) * precoA;
          valueB = tipo === "faturamento" && b.valor_faturado ? Number(b.valor_faturado) : Number(b.quantidade) * precoB;
          break;
        case "extra":
          valueA = a[extraCol.field] || "";
          valueB = b[extraCol.field] || "";
          break;
        default:
          valueA = 0;
          valueB = 0;
      }

      if (typeof valueA === "string") {
        valueA = valueA.toLowerCase();
        valueB = (valueB as string).toLowerCase();
      }

      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [lancamentos, siteFilter, projetoFilter, itemFilter, selectedMedicoes, sortField, sortDirection, dataField, extraCol.field, tipo]);

  // Calculate totals from filtered data
  const totalQuantidade = filteredAndSortedLancamentos.reduce((sum, l) => sum + Number(l.quantidade), 0);
  const totalValor = filteredAndSortedLancamentos.reduce((sum, l) => {
    const preco = Number(l.item_lpu?.preco_unitario || 0);
    const valor = tipo === "faturamento" && l.valor_faturado 
      ? Number(l.valor_faturado) 
      : Number(l.quantidade) * preco;
    return sum + valor;
  }, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <CardTitle>{titulo} ({filteredAndSortedLancamentos.length})</CardTitle>
            {tipo === "producao" && onBulkDelete && selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir {selectedIds.length} selecionado(s)
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={projetoFilter || "all"} onValueChange={(v) => setProjetoFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos projetos</SelectItem>
                {uniqueProjetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={siteFilter || "all"} onValueChange={(v) => setSiteFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos sites</SelectItem>
                {uniqueSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipo === "medicao" && uniqueMedicoes.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-44 justify-between">
                    <span className="truncate">
                      {selectedMedicoes.length === 0 
                        ? "Nº Medição" 
                        : `${selectedMedicoes.length} selecionado(s)`}
                    </span>
                    <Filter className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Nº Medição</span>
                      <Button variant="ghost" size="sm" onClick={handleSelectAllMedicoes}>
                        {selectedMedicoes.length === uniqueMedicoes.length ? "Limpar" : "Todos"}
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-auto p-2">
                    {uniqueMedicoes.map((medicao) => (
                      <div key={medicao} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded">
                        <Checkbox
                          id={`medicao-${medicao}`}
                          checked={selectedMedicoes.includes(medicao)}
                          onCheckedChange={() => handleMedicaoToggle(medicao)}
                        />
                        <label htmlFor={`medicao-${medicao}`} className="text-sm cursor-pointer flex-1">
                          {medicao}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Input
              placeholder="Buscar item..."
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {lancamentos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado</p>
        ) : filteredAndSortedLancamentos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum resultado para os filtros aplicados</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tipo === "producao" && onBulkDelete && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.length === filteredAndSortedLancamentos.length && filteredAndSortedLancamentos.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("data")} className="h-8 px-2 -ml-2">
                      Data {getSortIcon("data")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("projeto")} className="h-8 px-2 -ml-2">
                      Projeto {getSortIcon("projeto")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("site")} className="h-8 px-2 -ml-2">
                      Site {getSortIcon("site")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("item")} className="h-8 px-2 -ml-2">
                      Item LPU {getSortIcon("item")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("quantidade")} className="h-8 px-2">
                      Qtd {getSortIcon("quantidade")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("valor")} className="h-8 px-2">
                      Valor {getSortIcon("valor")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("extra")} className="h-8 px-2 -ml-2">
                      {extraCol.label} {getSortIcon("extra")}
                    </Button>
                  </TableHead>
                  {tipo === "medicao" && <TableHead>Status</TableHead>}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLancamentos.map((l) => {
                  const preco = Number(l.item_lpu?.preco_unitario || 0);
                  const valor = tipo === "faturamento" && l.valor_faturado 
                    ? Number(l.valor_faturado) 
                    : Number(l.quantidade) * preco;

                  return (
                    <TableRow key={l.id}>
                      {tipo === "producao" && onBulkDelete && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(l.id)}
                            onCheckedChange={() => handleSelectItem(l.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>{formatDate(l[dataField])}</TableCell>
                      <TableCell>{l.site?.projeto?.codigo || "-"}</TableCell>
                      <TableCell>{l.site?.codigo} - {l.site?.nome}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {l.item_lpu?.codigo} - {l.item_lpu?.descricao}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${Number(l.quantidade) < 0 ? "text-red-600" : ""}`}>
                        {Number(l.quantidade).toLocaleString("pt-BR")} {l.item_lpu?.unidade}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${valor < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(valor)}
                      </TableCell>
                      <TableCell>{l[extraCol.field] || "-"}</TableCell>
                      {tipo === "medicao" && (
                        <TableCell>{getStatusBadge(l.status || "aprovado")}</TableCell>
                      )}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(l.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={tipo === "producao" && onBulkDelete ? 5 : 4} className="text-right">TOTAL:</TableCell>
                  <TableCell className={`text-right font-mono ${totalQuantidade < 0 ? "text-red-600" : ""}`}>
                    {totalQuantidade.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className={`text-right text-lg ${totalValor < 0 ? "text-red-600" : ""}`}>
                    {formatCurrency(totalValor)}
                  </TableCell>
                  <TableCell colSpan={tipo === "medicao" ? 3 : 2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
