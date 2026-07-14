import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Receipt, RefreshCw, FilterX, Search, Eye } from "lucide-react";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FaturamentoContaAzul, useSyncContaAzulVendas } from "@/hooks/useFaturamento";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

interface Props {
  notas: FaturamentoContaAzul[];
  loading: boolean;
}

export function NotasContaAzulTab({ notas, loading }: Props) {
  const syncContaAzul = useSyncContaAzulVendas();

  // Filtros
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clienteFilter, setClienteFilter] = useState<string>("all");
  const [centroFilter, setCentroFilter] = useState<string>("all");

  // Sync params
  const [syncFrom, setSyncFrom] = useState("");
  const [syncTo, setSyncTo] = useState("");

  // Modal de detalhes
  const [selectedNota, setSelectedNota] = useState<FaturamentoContaAzul | null>(null);

  const clientes = useMemo(() => {
    const set = new Set(notas.map((n) => n.cliente_nome).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [notas]);

  const centros = useMemo(() => {
    const set = new Set(notas.map((n) => n.centro_custo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [notas]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notas.filter((n) => {
      if (term) {
        const hay = `${n.numero_nota || ""} ${n.cliente_nome || ""} ${n.centro_custo || ""} ${n.status || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (dateFrom && n.data_emissao < dateFrom) return false;
      if (dateTo && n.data_emissao > dateTo) return false;
      if (clienteFilter !== "all" && n.cliente_nome !== clienteFilter) return false;
      if (centroFilter !== "all" && n.centro_custo !== centroFilter) return false;
      return true;
    });
  }, [notas, search, dateFrom, dateTo, clienteFilter, centroFilter]);

  // Header filters + sort per column
  const COLUMNS = [
    "numero_nota",
    "numero_venda",
    "data_emissao",
    "cliente_nome",
    "centro_custo",
    "descricao",
    "valor_total",
    "valor_aberto",
    "valor_baixado",
    "status",
  ] as const;
  type ColKey = (typeof COLUMNS)[number];

  const columnLabels: Record<ColKey, string> = {
    numero_nota: "Nº Nota",
    numero_venda: "Nº Venda",
    data_emissao: "Data Emissão",
    cliente_nome: "Cliente",
    centro_custo: "Centro de Custo",
    descricao: "Descrição",
    valor_total: "Total",
    valor_aberto: "Em Aberto",
    valor_baixado: "Baixado",
    status: "Status",
  };

  const getColValue = (n: FaturamentoContaAzul, col: ColKey): string => {
    if (col === "data_emissao") return n.data_emissao || "";
    if (col === "valor_total" || col === "valor_aberto" || col === "valor_baixado") {
      return (Number((n as any)[col]) || 0).toFixed(2);
    }
    const v = (n as any)[col];
    return v == null || v === "" ? "-" : String(v);
  };

  const {
    sortColumn, sortDir, searchTexts, selectedFilters, handleSort, setSearchText, toggleValue,
    selectAll, clearAll, clearAllFilters: clearHeaderFilters, hasActiveFilters: hasHeaderFilters,
    processedItems, uniqueValues, paginatedItems,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages,
  } = useTableFilters<FaturamentoContaAzul, ColKey>(filtered, COLUMNS, getColValue, "notas_ca");

  const total = processedItems.length;

  const valorTotalFiltrado = useMemo(
    () => processedItems.reduce((sum, n) => sum + (Number(n.valor_total) || 0), 0),
    [processedItems],
  );
  const valorAbertoFiltrado = useMemo(
    () => processedItems.reduce((sum, n) => sum + (Number(n.valor_aberto) || 0), 0),
    [processedItems],
  );
  const valorBaixadoFiltrado = useMemo(
    () => processedItems.reduce((sum, n) => sum + (Number(n.valor_baixado) || 0), 0),
    [processedItems],
  );

  const hasFilters = !!(search || dateFrom || dateTo || clienteFilter !== "all" || centroFilter !== "all") || hasHeaderFilters;
  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setClienteFilter("all");
    setCentroFilter("all");
    clearHeaderFilters();
  };

  // Detalhes derivados do payload_json
  const detalhes = useMemo(() => {
    if (!selectedNota?.payload_json) return null;
    const p: any = selectedNota.payload_json;
    const itens = p.itens || p.items || p.produtos_servicos || [];
    const rateios = p.rateio_centro_custo || p.rateios_centro_custo || [];
    const totalPorCentro: Record<string, number> = {};
    for (const r of rateios) {
      const nome = r.centro_custo?.nome || r.centro_custo_nome || "Sem centro";
      const valor = Number(r.valor || r.valor_rateio || 0);
      totalPorCentro[nome] = (totalPorCentro[nome] || 0) + valor;
    }
    return { itens, totalPorCentro, raw: p };
  }, [selectedNota]);

  return (
    <div className="space-y-4">
      {/* Bloco de sincronização */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sincronizar com Conta Azul</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data inicial (opcional)</Label>
              <Input type="date" value={syncFrom} onChange={(e) => setSyncFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final (opcional)</Label>
              <Input type="date" value={syncTo} onChange={(e) => setSyncTo(e.target.value)} className="w-44" />
            </div>
            <Button
              onClick={() => syncContaAzul.mutate({ date_from: syncFrom || undefined, date_to: syncTo || undefined })}
              disabled={syncContaAzul.isPending}
            >
              {syncContaAzul.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar período
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSyncFrom("");
                setSyncTo("");
                syncContaAzul.mutate({});
              }}
              disabled={syncContaAzul.isPending}
            >
              {syncContaAzul.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Buscar tudo (sem limite)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Deixe as datas em branco e use "Buscar tudo" para importar todo o histórico disponível no Conta Azul.
          </p>
        </CardContent>
      </Card>

      {/* Filtros + Tabela */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Notas Fiscais - Conta Azul</CardTitle>
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? "nota" : "notas"} • Total: {formatCurrency(valorTotalFiltrado)}
              </p>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <FilterX className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1 lg:col-span-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nº, cliente, centro..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select
                value={clienteFilter}
                onValueChange={(v) => {
                  setClienteFilter(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Centro de Custo</Label>
              <Select
                value={centroFilter}
                onValueChange={(v) => {
                  setCentroFilter(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os centros</SelectItem>
                  {centros.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
              <p className="text-muted-foreground">
                {hasFilters
                  ? "Nenhuma nota corresponde aos filtros aplicados."
                  : "Nenhuma nota fiscal sincronizada ainda."}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((col) => (
                        <TableHead
                          key={col}
                          className={col === "valor_total" || col === "valor_aberto" || col === "valor_baixado" ? "text-right" : ""}
                        >
                          <ColumnHeader
                            label={columnLabels[col]}
                            sortDir={sortColumn === col ? sortDir : null}
                            onSort={() => handleSort(col)}
                            searchText={searchTexts[col]}
                            onSearchChange={(v) => setSearchText(col, v)}
                            uniqueValues={uniqueValues[col]}
                            selectedValues={selectedFilters[col]}
                            onToggleValue={(v) => toggleValue(col, v)}
                            onSelectAll={() => selectAll(col, uniqueValues[col])}
                            onClearAll={() => clearAll(col)}
                          />
                        </TableHead>
                      ))}
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((nota) => (
                      <TableRow
                        key={nota.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedNota(nota)}
                      >
                        <TableCell className="font-medium">{nota.numero_nota || "S/N"}</TableCell>
                        <TableCell className="font-medium">{nota.numero_venda || "-"}</TableCell>
                        <TableCell>
                          {nota.data_emissao
                            ? format(parseISO(nota.data_emissao + "T12:00:00"), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={nota.cliente_nome || ""}>
                          {nota.cliente_nome || "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={nota.centro_custo || ""}>
                          {nota.centro_custo || (
                            <span className="text-muted-foreground italic text-xs">Não alocado</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={nota.descricao || ""}>
                          {nota.descricao || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(nota.valor_total)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">
                          {formatCurrency(nota.valor_aberto)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(nota.valor_baixado)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {nota.status || "Emitida"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNota(nota);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-semibold">
                        Total{hasFilters ? " (filtrado)" : ""}:
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(valorTotalFiltrado)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-600">
                        {formatCurrency(valorAbertoFiltrado)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(valorBaixadoFiltrado)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={total}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!selectedNota} onOpenChange={(open) => !open && setSelectedNota(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Nota {selectedNota?.numero_nota || "S/N"} —{" "}
              {selectedNota?.cliente_nome || "Cliente não identificado"}
            </DialogTitle>
          </DialogHeader>

          {selectedNota && (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Data emissão</p>
                  <p className="font-semibold">
                    {selectedNota.data_emissao
                      ? format(parseISO(selectedNota.data_emissao + "T12:00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "-"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="font-semibold">{formatCurrency(selectedNota.valor_total)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{selectedNota.status || "Emitida"}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">ID Conta Azul</p>
                  <p className="font-mono text-xs truncate" title={selectedNota.erp_id}>
                    {selectedNota.erp_id}
                  </p>
                </div>
              </div>

              {/* Itens da nota */}
              <div>
                <h4 className="font-semibold mb-2">Itens / Linhas</h4>
                {detalhes && detalhes.itens.length > 0 ? (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalhes.itens.map((item: any, idx: number) => {
                          const desc =
                            item.descricao ||
                            item.produto?.nome ||
                            item.servico?.nome ||
                            item.nome ||
                            "Item";
                          const qtd = Number(item.quantidade ?? item.qtde ?? 1);
                          const vu = Number(item.valor ?? item.valor_unitario ?? 0);
                          const tot = Number(item.valor_total ?? qtd * vu);
                          return (
                            <TableRow key={idx}>
                              <TableCell>{desc}</TableCell>
                              <TableCell className="text-right">{qtd}</TableCell>
                              <TableCell className="text-right">{formatCurrency(vu)}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(tot)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem itens detalhados no payload.</p>
                )}
              </div>

              {/* Total por centro de custo */}
              <div>
                <h4 className="font-semibold mb-2">Total por Centro de Custo</h4>
                {detalhes && Object.keys(detalhes.totalPorCentro).length > 0 ? (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Centro de Custo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(detalhes.totalPorCentro).map(([nome, valor]) => (
                          <TableRow key={nome}>
                            <TableCell>{nome}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Centro de custo: {selectedNota.centro_custo || "Não alocado"}
                  </p>
                )}
              </div>

              {/* JSON bruto */}
              <div>
                <h4 className="font-semibold mb-2">JSON de retorno (sincronização)</h4>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-80">
                  {JSON.stringify(selectedNota.payload_json ?? selectedNota, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNota(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
