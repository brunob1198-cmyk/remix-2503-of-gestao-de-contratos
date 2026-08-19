import { useState } from "react";
import { useSgsstIncidentes, SgsstIncidente, StatusIncidente, TipoIncidente, GravidadeIncidente } from "@/hooks/sgsst/useSgsstIncidentes";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { Plus, Search, Edit2, Trash2, Siren, Eye, CheckCircle2, XCircle, PlayCircle, Lock, AlertTriangle, FileText } from "lucide-react";
import { IncidenteFormDialog } from "@/components/sgsst/IncidenteFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstIncidentesListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-incidentes");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedGravidade, setSelectedGravidade] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const { incidentes, total, isLoading, error, refetch, createIncidente, updateIncidente, removeIncidente } = useSgsstIncidentes({
    page,
    pageSize,
    search: debouncedSearch,
    status: selectedStatus,
    tipo: selectedTipo,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIncidente, setEditingIncidente] = useState<SgsstIncidente | null>(null);

  const handleCreateNew = () => {
    setEditingIncidente(null);
    setIsFormOpen(true);
  };

  const handleEdit = (inc: SgsstIncidente, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIncidente(inc);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/incidentes/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingIncidente) {
      await updateIncidente.mutateAsync({ id: editingIncidente.id, ...data });
    } else {
      await createIncidente.mutateAsync(data);
    }
  };

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const getGravidadeBadge = (g: GravidadeIncidente) => {
    switch (g) {
      case "BAIXA":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">BAIXA</Badge>;
      case "MEDIA":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">MÉDIA</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">ALTA</Badge>;
      case "CRITICA":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">CRÍTICA</Badge>;
      default:
        return <Badge variant="outline">{g}</Badge>;
    }
  };

  const getStatusBadge = (status: StatusIncidente) => {
    switch (status) {
      case "REGISTRADO":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 flex items-center gap-1 w-fit">
            <Siren className="h-3 w-3 text-red-500" /> REGISTRADO
          </Badge>
        );
      case "EM_INVESTIGACAO":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 w-fit">
            <Search className="h-3 w-3" /> EM INVESTIGAÇÃO
          </Badge>
        );
      case "PLANO_ACAO":
        return (
          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1 w-fit">
            <FileText className="h-3 w-3" /> PLANO DE AÇÃO
          </Badge>
        );
      case "EM_TRATAMENTO":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <PlayCircle className="h-3 w-3" /> EM TRATAMENTO
          </Badge>
        );
      case "ENCERRADO":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> ENCERRADO
          </Badge>
        );
      case "CANCELADO":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> CANCELADO
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Uma lista vazia com filtro ativo e um resultado de filtro, nao ausencia
  // de cadastro; a mensagem e a acao oferecida precisam ser diferentes.
  // Rótulo legível para os chips de filtro ativo: os valores são enums em
  // MAIÚSCULA_COM_UNDERSCORE, que não devem aparecer crus na interface.
  const rotuloFiltro = (valor: string) =>
    valor
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());

  const temFiltroAtivo = searchTerm.trim().length > 0 || selectedTipo !== "todos" || selectedGravidade !== "todos" || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedTipo("todos");
    setSelectedGravidade("todos");
    setSelectedStatus("todos");
  };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando ha dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: incidentes.length === 0,
    modulo: "Incidentes",
    onRetry: refetch,
    emptyTitulo: "Nenhum incidente registrado",
    emptyDescricao:
      "Registre incidentes e acidentes para investigar causas e acompanhar o plano de ação. Nenhum registro é um bom sinal.",
    filtrado: temFiltroAtivo,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-red-600">
            <Siren className="h-6 w-6 text-red-600" />
            SGSST — Incidentes e Acidentes de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro, investigações de causa raiz, pessoas envolvidas e planos de ação preventiva/corretiva.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} variant="destructive" className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Nova Ocorrência
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidentes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Investigação / Tratamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {incidentes.filter((i) => i.status === "EM_INVESTIGACAO" || i.status === "PLANO_ACAO" || i.status === "EM_TRATAMENTO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Encerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {incidentes.filter((i) => i.status === "ENCERRADO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gravidade Crítica / Alta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {incidentes.filter((i) => i.gravidade === "CRITICA" || i.gravidade === "ALTA").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por código ou título da ocorrência..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(selectedTipo !== "todos"
            ? [{ label: "Tipo", value: selectedTipo, onClear: () => setSelectedTipo("todos") }]
            : []),
          ...(selectedGravidade !== "todos"
            ? [{ label: "Gravidade", value: selectedGravidade, onClear: () => setSelectedGravidade("todos") }]
            : []),
          ...(selectedStatus !== "todos"
            ? [{ label: "Status", value: rotuloFiltro(selectedStatus), onClear: () => setSelectedStatus("todos") }]
            : []),
        ]}
      >
          <Select value={selectedTipo} onValueChange={setSelectedTipo}>
            <SelectTrigger className="w-[150px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Tipos</SelectItem>
              <SelectItem value="Incidente">Incidente</SelectItem>
              <SelectItem value="Acidente">Acidente Geral</SelectItem>
              <SelectItem value="Quase Acidente">Quase Acidente</SelectItem>
              <SelectItem value="Acidente com Afastamento">C/ Afastamento</SelectItem>
              <SelectItem value="Acidente sem Afastamento">S/ Afastamento</SelectItem>
              <SelectItem value="Ocorrência Ambiental">Ambiental</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedGravidade} onValueChange={setSelectedGravidade}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="Gravidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Gravidades</SelectItem>
              <SelectItem value="BAIXA">Baixa</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="REGISTRADO">Registrado</SelectItem>
              <SelectItem value="EM_INVESTIGACAO">Em Investigação</SelectItem>
              <SelectItem value="PLANO_ACAO">Plano de Ação</SelectItem>
              <SelectItem value="EM_TRATAMENTO">Em Tratamento</SelectItem>
              <SelectItem value="ENCERRADO">Encerrado</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
      </SgsstFilterBar>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título da Ocorrência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Gravidade</TableHead>
                <TableHead>Obra / Local</TableHead>
                <TableHead>Data Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                incidentes.map((inc) => (
                  <TableRow
                    key={inc.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(inc.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {inc.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate">{inc.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">{inc.descricao}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {inc.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>{getGravidadeBadge(inc.gravidade)}</TableCell>
                    <TableCell className="text-xs">
                      <div>{inc.projeto ? `[${inc.projeto.codigo}] ${inc.projeto.nome}` : "—"}</div>
                      <div className="text-muted-foreground truncate">{inc.local_ocorrencia || "Local não especificado"}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatDateStr(inc.data_ocorrencia)}
                    </TableCell>
                    <TableCell>{getStatusBadge(inc.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(inc.id);
                          }}
                          title="Abrir Detalhes e Investigação"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && inc.status !== "ENCERRADO" && inc.status !== "CANCELADO" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(inc, e)}
                              title="Editar Ocorrência"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir ocorrência "{inc.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A investigação, planos de ação e dados de envolvidos desta ocorrência serão excluídos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeIncidente.mutate(inc.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={page + 1}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p - 1)}
            itemsPerPage={pageSize}
            onItemsPerPageChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
            totalItems={total}
          />
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <IncidenteFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        incidente={editingIncidente}
        onSave={handleSave}
        isLoading={createIncidente.isPending || updateIncidente.isPending}
      />
    </div>
  );
}
