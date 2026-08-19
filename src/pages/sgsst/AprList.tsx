import { useState } from "react";
import { useSgsstApr, SgsstApr, StatusApr } from "@/hooks/sgsst/useSgsstApr";
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
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { Plus, Search, Edit2, Trash2, ClipboardList, Eye, CheckCircle2, XCircle, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { AprFormDialog } from "@/components/sgsst/AprFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstAprListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-apr");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const { count: countApr, isLoading: loadingResumo } = useSgsstCounts("sgsst_apr", [
    { key: "total" },
    { key: "aprovadas", build: (q) => q.eq("status", "APROVADA") },
    { key: "emAnalise", build: (q) => q.in("status", ["EM_ANALISE", "RASCUNHO"]) },
    { key: "encerradas", build: (q) => q.in("status", ["REJEITADA", "ENCERRADA", "CANCELADA"]) },
  ]);

  const { aprs, total, isLoading, error, refetch, createApr, updateApr, removeApr } = useSgsstApr({
    page,
    pageSize,
    search: debouncedSearch,
    status: selectedStatus,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingApr, setEditingApr] = useState<SgsstApr | null>(null);

  const handleCreateNew = () => {
    setEditingApr(null);
    setIsFormOpen(true);
  };

  const handleEdit = (apr: SgsstApr, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingApr(apr);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/apr/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingApr) {
      await updateApr.mutateAsync({ id: editingApr.id, ...data });
    } else {
      await createApr.mutateAsync(data);
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

  const getStatusBadge = (status: StatusApr) => {
    switch (status) {
      case "RASCUNHO":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1 w-fit">
            <RefreshCw className="h-3 w-3" /> RASCUNHO
          </Badge>
        );
      case "EM_ANALISE":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" /> EM ANÁLISE
          </Badge>
        );
      case "APROVADA":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> APROVADA
          </Badge>
        );
      case "REJEITADA":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> REJEITADA
          </Badge>
        );
      case "CANCELADA":
      case "ENCERRADA":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1 w-fit">
            <Lock className="h-3 w-3" /> {status}
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

  const temFiltroAtivo = searchTerm.trim().length > 0 || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedStatus("todos");
  };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando ha dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: aprs.length === 0,
    modulo: "APR",
    onRetry: refetch,
    emptyTitulo: "Nenhuma APR cadastrada ainda",
    emptyDescricao:
      "A APR analisa os riscos de uma atividade antes dela começar. Crie a primeira para liberar execução em campo.",
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
            <ClipboardList className="h-6 w-6 text-primary" />
            SGSST — Análise Preliminar de Riscos (APR)
          </h1>
          <p className="text-sm text-muted-foreground">
            Avaliação prévia de segurança, identificação de perigos por etapa e plano de ação de campo.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova APR
          </Button>
        )}
      </div>

      {/* Indicadores — contagens sobre a base inteira, não sobre a página */}
      <SgsstStatCards
        isLoading={loadingResumo}
        stats={[
          {
            label: "Total de APRs",
            value: countApr("total"),
            tone: "info",
            icon: ClipboardList,
            ajuda: "Todas as APRs da empresa, independente de status.",
          },
          {
            label: "APRs Aprovadas",
            value: countApr("aprovadas"),
            tone: "positivo",
            icon: CheckCircle2,
            ajuda: "APRs liberadas para execução da atividade em campo.",
          },
          {
            label: "Em Análise / Rascunho",
            value: countApr("emAnalise"),
            tone: "atencao",
            icon: AlertCircle,
            hint: "não liberam execução",
            ajuda: "APRs ainda em elaboração ou aguardando aprovação técnica.",
          },
          {
            label: "Rejeitadas / Encerradas",
            value: countApr("encerradas"),
            tone: "neutro",
            icon: Lock,
            ajuda: "APRs rejeitadas, encerradas ou canceladas, mantidas para histórico.",
          },
        ]}
      />

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por código ou título da APR..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(selectedStatus !== "todos"
            ? [{ label: "Status", value: rotuloFiltro(selectedStatus), onClear: () => setSelectedStatus("todos") }]
            : []),
        ]}
      >
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
              <SelectItem value="APROVADA">Aprovada</SelectItem>
              <SelectItem value="REJEITADA">Rejeitada</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
              <SelectItem value="ENCERRADA">Encerrada</SelectItem>
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
                <TableHead>Título / Atividade</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Setor / Área</TableHead>
                <TableHead>Elaboração</TableHead>
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
                aprs.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(a.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {a.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate">{a.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.atividade}</div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.projeto ? `[${a.projeto.codigo}] ${a.projeto.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.area ? a.area.nome : "Geral"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateStr(a.data)}
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(a.id);
                          }}
                          title="Abrir Detalhes e Etapas"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && (a.status === "RASCUNHO" || a.status === "EM_ANALISE" || a.status === "REJEITADA") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(a, e)}
                              title="Editar APR"
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
                                  <AlertDialogTitle>Excluir APR "{a.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todas as etapas, riscos, medidas de controle e participantes desta APR serão removidos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeApr.mutate(a.id)}>
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
      <AprFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        apr={editingApr}
        onSave={handleSave}
        isLoading={createApr.isPending || updateApr.isPending}
      />
    </div>
  );
}
