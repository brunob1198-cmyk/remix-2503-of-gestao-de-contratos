import { useState } from "react";
import { useSgsstInspecoes, SgsstInspecao, StatusInspecao, TipoInspecao } from "@/hooks/sgsst/useSgsstInspecoes";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { Plus, Search, Edit2, Trash2, SearchCheck, Eye, CheckCircle2, XCircle, PlayCircle, Lock, Calendar } from "lucide-react";
import { InspecaoFormDialog } from "@/components/sgsst/InspecaoFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstInspecoesListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-inspecoes");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  // Indicadores sobre a base inteira: derivar da página corrente fazia os
  // cartões medirem apenas as linhas visíveis.
  const { count: countInsp } = useSgsstCounts("sgsst_inspecoes", [
    { key: "total" },
    { key: "concluidas", build: (q) => q.eq("status", "CONCLUIDA") },
    { key: "emExecucao", build: (q) => q.eq("status", "EM_EXECUCAO") },
    { key: "planejadas", build: (q) => q.eq("status", "PLANEJADA") },
  ]);

  const { inspecoes, total, isLoading, error, refetch, createInspecao, updateInspecao, removeInspecao } = useSgsstInspecoes({
    page,
    pageSize,
    search: debouncedSearch,
    status: selectedStatus,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInspecao, setEditingInspecao] = useState<SgsstInspecao | null>(null);

  const handleCreateNew = () => {
    setEditingInspecao(null);
    setIsFormOpen(true);
  };

  const handleEdit = (insp: SgsstInspecao, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInspecao(insp);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/inspecoes/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingInspecao) {
      await updateInspecao.mutateAsync({ id: editingInspecao.id, ...data });
    } else {
      await createInspecao.mutateAsync(data);
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

  const getStatusBadge = (status: StatusInspecao) => {
    switch (status) {
      case "PLANEJADA":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <Calendar className="h-3 w-3" /> PLANEJADA
          </Badge>
        );
      case "EM_EXECUCAO":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 w-fit">
            <PlayCircle className="h-3 w-3" /> EM EXECUÇÃO
          </Badge>
        );
      case "CONCLUIDA":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> CONCLUÍDA
          </Badge>
        );
      case "CANCELADA":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> CANCELADA
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

  const temFiltroAtivo = searchTerm.trim().length > 0 || selectedTipo !== "todos" || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedTipo("todos");
    setSelectedStatus("todos");
  };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando ha dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: inspecoes.length === 0,
    modulo: "Inspeções",
    onRetry: refetch,
    emptyTitulo: "Nenhuma inspeção agendada ainda",
    emptyDescricao:
      "As inspeções registram verificações de campo e geram não conformidades quando algo está fora do padrão.",
    filtrado: temFiltroAtivo,
    onLimparFiltros: limparFiltros,
  });

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SearchCheck className="h-6 w-6 text-primary" />
            SGSST — Inspeções de Segurança
          </h1>
          <p className="text-sm text-muted-foreground">
            Auditorias de campo, listas de verificação, detecção e plano de ação para não conformidades.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Agendar Inspeção
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countInsp("total")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {countInsp("concluidas")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {countInsp("emExecucao")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Planejadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {countInsp("planejadas")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por código ou título da inspeção..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(selectedTipo !== "todos"
            ? [{ label: "Tipo", value: selectedTipo, onClear: () => setSelectedTipo("todos") }]
            : []),
          ...(selectedStatus !== "todos"
            ? [{ label: "Status", value: rotuloFiltro(selectedStatus), onClear: () => setSelectedStatus("todos") }]
            : []),
        ]}
      >
          <Select value={selectedTipo} onValueChange={setSelectedTipo}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Tipo de Inspeção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Tipos</SelectItem>
              <SelectItem value="Inspeção de Segurança">Segurança</SelectItem>
              <SelectItem value="Inspeção de Área">Área / Setor</SelectItem>
              <SelectItem value="Inspeção de Equipamento">Equipamentos</SelectItem>
              <SelectItem value="Inspeção de EPI">EPIs</SelectItem>
              <SelectItem value="Inspeção de Trabalho">Trabalho</SelectItem>
              <SelectItem value="Inspeção de Obra">Obra Geral</SelectItem>
              <SelectItem value="Inspeção Comportamental">Comportamental</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="PLANEJADA">Planejada</SelectItem>
              <SelectItem value="EM_EXECUCAO">Em Execução</SelectItem>
              <SelectItem value="CONCLUIDA">Concluída</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
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
                <TableHead>Título da Inspeção</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Data Planejada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                inspecoes.map((i) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(i.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {i.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {i.titulo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {i.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.projeto ? `[${i.projeto.codigo}] ${i.projeto.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatDateStr(i.data_planejada)}
                    </TableCell>
                    <TableCell>{getStatusBadge(i.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(i.id);
                          }}
                          title="Abrir Detalhes e Checklist"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && i.status !== "CONCLUIDA" && i.status !== "CANCELADA" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(i, e)}
                              title="Editar Inspeção"
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
                                  <AlertDialogTitle>Excluir inspeção "{i.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O checklist e todas as Não Conformidades associadas a esta inspeção serão removidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeInspecao.mutate(i.id)}>
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
      <InspecaoFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        inspecao={editingInspecao}
        onSave={handleSave}
        isLoading={createInspecao.isPending || updateInspecao.isPending}
      />
    </div>
  );
}
