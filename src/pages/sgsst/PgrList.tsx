import { useEffect, useState } from "react";
import { useSgsstPgr, useSgsstPgrResumo, SgsstPgr, StatusPgr } from "@/hooks/sgsst/useSgsstPgr";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, FileCheck, Eye, CheckCircle2, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { PgrFormDialog } from "@/components/sgsst/PgrFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstPgrListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pgr");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const { pgrs, total, isLoading, error, refetch, createPgr, updatePgr, updateStatusPgr, removePgr } =
    useSgsstPgr({
      page,
      pageSize,
      search: debouncedSearch,
      status: selectedStatus,
    });

  const { resumo, isLoading: loadingResumo } = useSgsstPgrResumo();

  const totalPages = Math.ceil(total / pageSize) || 1;

  // Voltar para a primeira pagina quando os filtros mudam: sem isto, filtrar
  // estando na pagina 4 pede um range que o resultado filtrado nao tem e a
  // tabela aparece vazia mesmo havendo registros.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, selectedStatus]);

  const temFiltroAtivo = debouncedSearch.trim().length > 0 || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedStatus("todos");
  };

  const STATUS_LABEL: Record<string, string> = {
    RASCUNHO: "Rascunho",
    ATIVO: "Ativo",
    EM_REVISAO: "Em revisão",
    ENCERRADO: "Encerrado",
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPgr, setEditingPgr] = useState<SgsstPgr | null>(null);

  const handleCreateNew = () => {
    setEditingPgr(null);
    setIsFormOpen(true);
  };

  const handleEdit = (pgr: SgsstPgr, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPgr(pgr);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/pgr/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingPgr) {
      await updatePgr.mutateAsync({ id: editingPgr.id, ...data });
    } else {
      await createPgr.mutateAsync(data);
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

  const getStatusBadge = (status: StatusPgr) => {
    switch (status) {
      case "RASCUNHO":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1 w-fit">
            <RefreshCw className="h-3 w-3" /> RASCUNHO
          </Badge>
        );
      case "ATIVO":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> ATIVO
          </Badge>
        );
      case "EM_REVISAO":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" /> EM REVISÃO
          </Badge>
        );
      case "ENCERRADO":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 flex items-center gap-1 w-fit">
            <Lock className="h-3 w-3" /> ENCERRADO
          </Badge>
        );
      default:
        return null;
    }
  };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando há dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: pgrs.length === 0,
    modulo: "PGR",
    onRetry: refetch,
    emptyTitulo: "Nenhum PGR cadastrado ainda",
    emptyDescricao:
      "O PGR reúne o inventário de riscos da obra e as medidas de controle. Crie o primeiro documento para começar.",
    emptyAction: allowEdit ? (
      <Button onClick={handleCreateNew} size="sm" className="gap-2">
        <Plus className="h-4 w-4" /> Novo Documento PGR
      </Button>
    ) : undefined,
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
            <FileCheck className="h-6 w-6 text-primary" />
            SGSST — Programa de Gerenciamento de Riscos (PGR)
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão dos documentos do PGR e Inventários de Riscos Ocupacionais das Obras.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Documento PGR
          </Button>
        )}
      </div>

      {/* Indicadores — contagens sobre a base inteira, não sobre a página */}
      <SgsstStatCards
        isLoading={loadingResumo}
        stats={[
          {
            label: "Total de PGRs",
            value: resumo.total,
            tone: "info",
            icon: FileCheck,
            ajuda: "Todos os PGRs da empresa, independente de status.",
          },
          {
            label: "PGRs Ativos",
            value: resumo.ativos,
            tone: "positivo",
            icon: CheckCircle2,
            ajuda: "PGRs com status Ativo — os que valem hoje para as obras.",
          },
          {
            label: "Em Revisão / Rascunho",
            value: resumo.emRevisao,
            tone: "atencao",
            icon: AlertCircle,
            hint: "aguardando conclusão",
            ajuda: "PGRs em elaboração ou revisão; ainda não valem como documento oficial.",
          },
          {
            label: "Encerrados",
            value: resumo.encerrados,
            tone: "neutro",
            icon: Lock,
            ajuda: "PGRs encerrados, mantidos apenas para histórico e auditoria.",
          },
        ]}
      />

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por código ou título do PGR..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={
          selectedStatus !== "todos"
            ? [
                {
                  label: "Status",
                  value: STATUS_LABEL[selectedStatus] ?? selectedStatus,
                  onClear: () => setSelectedStatus("todos"),
                },
              ]
            : []
        }
      >
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="ATIVO">Ativo</SelectItem>
            <SelectItem value="EM_REVISAO">Em Revisão</SelectItem>
            <SelectItem value="ENCERRADO">Encerrado</SelectItem>
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
                <TableHead>Título do PGR</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Canteiro / Site</TableHead>
                <TableHead>Vigência</TableHead>
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
                pgrs.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(p.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {p.titulo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.projeto ? `[${p.projeto.codigo}] ${p.projeto.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.site ? p.site.nome : "Geral"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateStr(p.data_inicio)}
                    </TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(p.id);
                          }}
                          title="Abrir Inventário e Detalhes"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(p, e)}
                              title="Editar PGR"
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
                                  title="Excluir PGR"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir PGR "{p.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação removerá permanentemente o PGR e todo seu inventário de riscos vinculado.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removePgr.mutate(p.id)}>
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
      <PgrFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        pgr={editingPgr}
        onSave={handleSave}
        isLoading={createPgr.isPending || updatePgr.isPending}
      />
    </div>
  );
}
