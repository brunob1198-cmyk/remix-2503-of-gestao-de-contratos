import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Save, Trash2, Search, History } from "lucide-react";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { StatusHistoryPopover, getStatusBadge } from "./StatusHistoryPopover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface MedicoesTableProps {
  tableMedicoes: any;
  localEdits: any;
  handleFieldChange: (id: string, field: string, value: any) => void;
  handleSaveRow: (medicao: any) => void;
  handleDeleteMedicao: (medicao: any) => void;
  setDetailMedicaoId: (id: string) => void;
  setPartialApprovalMedicaoId: (id: string) => void;
  setPartialApprovalItems: (items: Record<string, number>) => void;
  formatDate: (d: string) => string;
  formatCurrency: (v: number) => string;
  formatDateTime: (d: string) => string;
  STATUS_OPTIONS: any[];
  bulkUpdateMedicaoFields: any;
  lancamentos: any[];
}

export function MedicoesTable({
  tableMedicoes,
  localEdits,
  handleFieldChange,
  handleSaveRow,
  handleDeleteMedicao,
  setDetailMedicaoId,
  setPartialApprovalMedicaoId,
  setPartialApprovalItems,
  formatDate,
  formatCurrency,
  formatDateTime,
  STATUS_OPTIONS,
  bulkUpdateMedicaoFields,
  lancamentos
}: MedicoesTableProps) {
  
  const totalValor = tableMedicoes.processedItems.reduce((sum: number, m: any) => sum + m.total_valor, 0);

  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>
                <ColumnHeader
                  label="Projeto"
                  sortDir={tableMedicoes.sortColumn === "projeto" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("projeto")}
                  searchText={tableMedicoes.searchTexts["projeto"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("projeto", v)}
                  uniqueValues={tableMedicoes.uniqueValues["projeto"]}
                  selectedValues={tableMedicoes.selectedFilters["projeto"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("projeto", v)}
                  onSelectAll={() => tableMedicoes.selectAll("projeto", tableMedicoes.uniqueValues["projeto"])}
                  onClearAll={() => tableMedicoes.clearAll("projeto")}
                />
              </TableHead>
              <TableHead>
                <ColumnHeader
                  label="Site"
                  sortDir={tableMedicoes.sortColumn === "site" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("site")}
                  searchText={tableMedicoes.searchTexts["site"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("site", v)}
                  uniqueValues={tableMedicoes.uniqueValues["site"]}
                  selectedValues={tableMedicoes.selectedFilters["site"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("site", v)}
                  onSelectAll={() => tableMedicoes.selectAll("site", tableMedicoes.uniqueValues["site"])}
                  onClearAll={() => tableMedicoes.clearAll("site")}
                />
              </TableHead>
              <TableHead>
                <ColumnHeader
                  label="UF"
                  sortDir={tableMedicoes.sortColumn === "uf" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("uf")}
                  searchText={tableMedicoes.searchTexts["uf"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("uf", v)}
                  uniqueValues={tableMedicoes.uniqueValues["uf"]}
                  selectedValues={tableMedicoes.selectedFilters["uf"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("uf", v)}
                  onSelectAll={() => tableMedicoes.selectAll("uf", tableMedicoes.uniqueValues["uf"])}
                  onClearAll={() => tableMedicoes.clearAll("uf")}
                />
              </TableHead>
              <TableHead>
                <ColumnHeader
                  label="Data"
                  sortDir={tableMedicoes.sortColumn === "data" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("data")}
                  searchText={tableMedicoes.searchTexts["data"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("data", v)}
                  uniqueValues={tableMedicoes.uniqueValues["data"]}
                  selectedValues={tableMedicoes.selectedFilters["data"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("data", v)}
                  onSelectAll={() => tableMedicoes.selectAll("data", tableMedicoes.uniqueValues["data"])}
                  onClearAll={() => tableMedicoes.clearAll("data")}
                />
              </TableHead>
              <TableHead>Período</TableHead>
              <TableHead>
                <ColumnHeader
                  label="Nº Medição"
                  sortDir={tableMedicoes.sortColumn === "numero" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("numero")}
                  searchText={tableMedicoes.searchTexts["numero"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("numero", v)}
                  uniqueValues={tableMedicoes.uniqueValues["numero"]}
                  selectedValues={tableMedicoes.selectedFilters["numero"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("numero", v)}
                  onSelectAll={() => tableMedicoes.selectAll("numero", tableMedicoes.uniqueValues["numero"])}
                  onClearAll={() => tableMedicoes.clearAll("numero")}
                />
              </TableHead>
              <TableHead className="text-right">
                <ColumnHeader
                  label="Valor Total"
                  sortDir={tableMedicoes.sortColumn === "valor" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("valor")}
                  searchText={tableMedicoes.searchTexts["valor"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("valor", v)}
                  uniqueValues={tableMedicoes.uniqueValues["valor"]}
                  selectedValues={tableMedicoes.selectedFilters["valor"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("valor", v)}
                  onSelectAll={() => tableMedicoes.selectAll("valor", tableMedicoes.uniqueValues["valor"])}
                  onClearAll={() => tableMedicoes.clearAll("valor")}
                />
              </TableHead>
              <TableHead>
                <ColumnHeader
                  label="Status"
                  sortDir={tableMedicoes.sortColumn === "status" ? tableMedicoes.sortDir : null}
                  onSort={() => tableMedicoes.handleSort("status")}
                  searchText={tableMedicoes.searchTexts["status"]}
                  onSearchChange={(v) => tableMedicoes.setSearchText("status", v)}
                  uniqueValues={tableMedicoes.uniqueValues["status"]}
                  selectedValues={tableMedicoes.selectedFilters["status"]}
                  onToggleValue={(v) => tableMedicoes.toggleValue("status", v)}
                  onSelectAll={() => tableMedicoes.selectAll("status", tableMedicoes.uniqueValues["status"])}
                  onClearAll={() => tableMedicoes.clearAll("status")}
                />
              </TableHead>
              <TableHead>Nº PO</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Data Resposta
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Search className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>Clique na lupa de cada linha para ver o histórico</TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableMedicoes.paginatedItems.map((m: any) => {
              const currentStatus = localEdits[m.id]?.status ?? m.status;
              const currentPo = localEdits[m.id]?.numero_po ?? m.numero_po ?? "";
              const currentObs = localEdits[m.id]?.observacao_acompanhamento ?? m.observacao_acompanhamento ?? "";
              const hasChanges = !!localEdits[m.id];
              const isRejected = currentStatus === "rejeitado";

              return (
                <TableRow key={m.id} className={isRejected ? "bg-red-50 dark:bg-red-950/20" : ""}>
                  <TableCell className="font-medium">{m.projeto_codigo}</TableCell>
                  <TableCell>{m.site_codigo} - {m.site_nome}</TableCell>
                  <TableCell>{m.uf || "-"}</TableCell>
                  <TableCell>{formatDate(m.data_medicao)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {m.periodo_inicio && m.periodo_fim
                      ? `${formatDate(m.periodo_inicio)} a ${formatDate(m.periodo_fim)}`
                      : "-"}
                  </TableCell>
                  <TableCell>{m.numero_medicao || "-"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(m.total_valor)}</TableCell>
                  <TableCell>
                    <Select value={currentStatus} onValueChange={(value) => {
                      if (value === "rejeitado") {
                        setPartialApprovalMedicaoId(m.id);
                        const initial: Record<string, number> = {};
                        const medLancamentos = lancamentos.filter(l => m.lancamentoIds.includes(l.id));
                        medLancamentos.forEach(l => {
                          initial[l.id] = Number(l.quantidade_aprovada || l.quantidade);
                        });
                        setPartialApprovalItems(initial);
                      }
                      handleFieldChange(m.id, "status", value);
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue>{getStatusBadge(currentStatus)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={currentPo} onChange={(e) => handleFieldChange(m.id, "numero_po", e.target.value)} placeholder="Nº PO" className="w-24" />
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-40">
                          <Input 
                            value={currentObs} 
                            onChange={(e) => handleFieldChange(m.id, "observacao_acompanhamento", e.target.value)} 
                            placeholder="Observações" 
                          />
                        </div>
                      </TooltipTrigger>
                      {currentObs && (
                        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap break-words">
                          {currentObs}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <StatusHistoryPopover 
                      medicaoId={m.id}
                      siteId={m.site_id}
                      siteCodigo={m.site_codigo}
                      numeroMedicao={m.numero_medicao}
                      dataResposta={m.data_resposta}
                      formatDateTime={formatDateTime}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailMedicaoId(m.id)} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {hasChanges && (
                        <Button size="sm" onClick={() => handleSaveRow(m)} disabled={bulkUpdateMedicaoFields.isPending}>
                          <Save className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Excluir medição">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Medição</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a medição {m.numero_medicao || ""} do site {m.site_codigo}?
                              Esta ação excluirá {m.lancamentoIds.length} lançamento(s) e não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMedicao(m)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={6} className="text-right">TOTAL:</TableCell>
              <TableCell className="text-right">{formatCurrency(totalValor)}</TableCell>
              <TableCell colSpan={5}></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <TablePagination
        currentPage={tableMedicoes.currentPage}
        totalPages={tableMedicoes.totalPages}
        onPageChange={tableMedicoes.setCurrentPage}
        itemsPerPage={tableMedicoes.itemsPerPage}
        onItemsPerPageChange={tableMedicoes.setItemsPerPage}
        totalItems={tableMedicoes.processedItems.length}
      />
    </div>
  );
}
