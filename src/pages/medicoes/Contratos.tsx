import { useState, useCallback, useMemo } from "react";
import { useContratos } from "@/hooks/useContratos";
import { useClientes } from "@/hooks/useClientes";
import { useProjetos } from "@/hooks/useProjetos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ScrollText, Pencil, Trash2, AlertTriangle, CalendarCheck, CalendarX, FileText, FolderOpen, FilterX } from "lucide-react";
import ContratosForm from "@/components/medicoes/ContratosForm";
import { supabase } from "@/integrations/supabase/client";
import { Contrato } from "@/types/medicoes";
import { differenceInDays, parseISO, isBefore, startOfDay } from "date-fns";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { useTableFilters } from "@/hooks/useTableFilters";
import { TablePagination } from "@/components/medicoes/TablePagination";

const COLUMNS = ["numero", "objeto", "clientes", "projetos", "valor", "vigencia", "status"] as const;
type ColKey = typeof COLUMNS[number];

export default function ContratosPage() {
  const { contratos, isLoading, deleteContrato } = useContratos();
  const { clientes } = useClientes();
  const { projetos } = useProjetos();
  const [isOpen, setIsOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);

  const formatCurrency = (val?: number) => val ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : "-";
  const formatDate = (val?: string) => val ? parseISO(val).toLocaleDateString('pt-BR') : "-";

  const calcularStatus = (prazoFim?: string) => {
    if (!prazoFim) return { label: "Sem Prazo", color: "bg-gray-100 text-gray-800", icon: <ScrollText className="h-3 w-3" /> };
    const fim = parseISO(prazoFim);
    const hoje = startOfDay(new Date());
    const diasRestantes = differenceInDays(fim, hoje);
    if (isBefore(fim, hoje)) return { label: "Vencido", color: "bg-red-100 text-red-800", icon: <CalendarX className="h-3 w-3" /> };
    if (diasRestantes <= 30) return { label: "Vence em breve", color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-3 w-3" /> };
    return { label: "Vigente", color: "bg-green-100 text-green-800", icon: <CalendarCheck className="h-3 w-3" /> };
  };

  const getClientesNomes = useCallback((ids?: string[]) => {
    if (!ids || ids.length === 0) return "-";
    return ids.map(id => clientes.find(c => c.id === id)?.razao_social || 'Desconhecido').join(", ");
  }, [clientes]);

  const getProjetosNomes = useCallback((contratoId: string) => {
    const vinculados = projetos.filter(p => 
      p.contrato_id === contratoId || 
      (p.contrato_ids && p.contrato_ids.includes(contratoId))
    );
    if (vinculados.length === 0) return "-";
    return vinculados.map(p => `${p.codigo} - ${p.nome}`).join(", ");
  }, [projetos]);

  const getValorIntegrado = useCallback((c: any) => {
    const aditivosVal = c.aditivos?.reduce((acc: number, ad: any) => acc + (ad.valor_total || 0), 0) || 0;
    return (c.valor_total || 0) + aditivosVal;
  }, []);

  const getColValue = useCallback((c: any, col: ColKey): string => {
    switch (col) {
      case "numero": return c.numero_contrato || "";
      case "objeto": return c.escopo || "";
      case "clientes": return getClientesNomes(c.cliente_ids);
      case "projetos": return getProjetosNomes(c.id);
      case "valor": return String(getValorIntegrado(c));
      case "vigencia": return c.prazo_fim || "";
      case "status": return calcularStatus(c.prazo_fim).label;
      default: return "";
    }
  }, [getClientesNomes, getProjetosNomes, getValorIntegrado]);

  const {
    sortColumn, sortDir, searchTexts, selectedFilters,
    handleSort, setSearchText, toggleValue, selectAll, clearAll, clearAllFilters,
    hasActiveFilters, processedItems, uniqueValues,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, paginatedItems
  } = useTableFilters(contratos, COLUMNS, getColValue);

  const somaValores = useMemo(() => {
    return processedItems.reduce((acc, c) => acc + getValorIntegrado(c), 0);
  }, [processedItems, getValorIntegrado]);

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este contrato e seus aditivos?")) {
      deleteContrato.mutate(id);
    }
  };

  const handleEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setIsOpen(true);
  };

  const colLabels: Record<ColKey, string> = {
    numero: "Nº Contrato",
    objeto: "Contrato / Objeto",
    clientes: "Clientes",
    projetos: "Projetos",
    valor: "Valor Integrado",
    vigencia: "Vigência",
    status: "Status",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Contratos e Aditivos</h2>
          <p className="text-sm text-muted-foreground">Gerencie todos os contratos da empresa.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setEditingContrato(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto">
            <ContratosForm 
              contratoToEdit={editingContrato} 
              onClose={() => { setIsOpen(false); setEditingContrato(null); }} 
              contratos={contratos}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Lista de Contratos Principais ({processedItems.length})
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Total Valor Integrado</span>
                <span className="text-lg font-bold font-mono text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(somaValores)}
                </span>
              </div>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  <FilterX className="h-4 w-4 mr-1" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8">Carregando...</p>
          ) : contratos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum contrato cadastrado</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map(col => (
                      <TableHead key={col}>
                        <ColumnHeader
                          label={colLabels[col]}
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((c: any) => {
                    const statusInfo = calcularStatus(c.prazo_fim);
                    const aditivosVal = c.aditivos?.reduce((acc: number, aditi: any) => acc + (aditi.valor_total || 0), 0) || 0;
                    const valorTotalIntegrado = (c.valor_total || 0) + aditivosVal;

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">
                          {c.numero_contrato || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm truncate max-w-[250px]" title={c.escopo || "Sem escopo"}>
                            {c.escopo || "Contrato s/ Objeto Definido"}
                          </div>
                          {c.aditivos && c.aditivos.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                Aditivos ({c.aditivos.length})
                              </div>
                              {c.aditivos.map((ad: any, idx: number) => (
                                <div key={ad.id} className="flex items-center justify-between bg-muted/50 p-1.5 rounded border border-muted-foreground/10 text-[11px]">
                                  <span className="font-medium truncate max-w-[120px]">Aditivo #{idx + 1}</span>
                                  <div className="flex gap-1">
                                    {ad.arquivo_url && (
                                      <button
                                        className="text-blue-600 hover:text-blue-800"
                                        onClick={async () => {
                                          const { data } = await supabase.storage.from('contratos').createSignedUrl(ad.arquivo_url!, 31536000);
                                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                        }}
                                      >
                                        <FileText className="h-3 w-3" />
                                      </button>
                                    )}
                                    <button onClick={() => handleEdit(ad)} className="text-muted-foreground hover:text-primary">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={getClientesNomes(c.cliente_ids)}>
                          {getClientesNomes(c.cliente_ids)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          {(() => {
                            const vinculados = projetos.filter(p => 
                              p.contrato_id === c.id || 
                              (p.contrato_ids && p.contrato_ids.includes(c.id))
                            );
                            if (vinculados.length === 0) return <span className="text-muted-foreground">-</span>;
                            return (
                              <div className="space-y-0.5">
                                {vinculados.map(p => (
                                  <div key={p.id} className="flex items-center gap-1" title={p.nome}>
                                    <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate">{p.codigo} - {p.nome}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatCurrency(valorTotalIntegrado)}
                          {aditivosVal > 0 && (
                            <span className="block text-xs text-muted-foreground">Original: {formatCurrency(c.valor_total)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          De {formatDate(c.prazo_inicio)}<br/>
                          Até <span className="font-semibold">{formatDate(c.prazo_fim)}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {c.arquivo_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver arquivo original"
                                onClick={async () => {
                                  const { data } = await supabase.storage.from('contratos').createSignedUrl(c.arquivo_url, 31536000);
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                }}
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                totalItems={processedItems.length}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
