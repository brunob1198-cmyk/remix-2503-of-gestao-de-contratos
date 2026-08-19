import { useEffect, useState } from "react";
import { useSgsstRiscos, SgsstRisco, CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { SgsstFilterBar } from "@/components/sgsst/SgsstFilterBar";
import { SgsstStatCards } from "@/components/sgsst/SgsstStatCards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveTableState } from "@/components/sgsst/SgsstStateFeedback";
import { Plus, Edit2, Trash2, AlertTriangle, Eye, CheckCircle2, XCircle, Activity, Biohazard, Sparkles } from "lucide-react";
import { RISCOS_PADRAO } from "@/utils/sgsstRiscosDefaults";
import { RiscosFormDialog } from "@/components/sgsst/RiscosFormDialog";
import { RiscosDetailDialog } from "@/components/sgsst/RiscosDetailDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstRiscosPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-riscos");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  // Busca e filtros no servidor: filtrar no cliente cobria apenas a pagina
  // carregada, escondendo riscos das demais paginas do catalogo.
  const {
    riscos,
    total,
    isLoading,
    error,
    refetch,
    createRisco,
    updateRisco,
    removeRisco,
    popularCatalogoPadrao,
  } = useSgsstRiscos({
      page,
      pageSize,
      search: debouncedSearch,
      categoria: selectedCategoria,
      status: selectedStatus,
    });

  const { count, isLoading: loadingResumo } = useSgsstCounts("sgsst_riscos_catalogo", [
    { key: "total" },
    { key: "ativos", build: (q) => q.eq("status", "ativo") },
    { key: "fisicoQuimico", build: (q) => q.in("categoria", ["Físico", "Químico"]) },
    { key: "ergoAcidente", build: (q) => q.in("categoria", ["Ergonômico", "Acidente"]) },
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, selectedCategoria, selectedStatus]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<SgsstRisco | null>(null);
  const [viewingRisco, setViewingRisco] = useState<SgsstRisco | null>(null);

  const handleCreateNew = () => {
    setEditingRisco(null);
    setIsFormOpen(true);
  };

  const handleEdit = (risco: SgsstRisco) => {
    setEditingRisco(risco);
    setIsFormOpen(true);
  };

  const handleView = (risco: SgsstRisco) => {
    setViewingRisco(risco);
    setIsDetailOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingRisco) {
      await updateRisco.mutateAsync({ id: editingRisco.id, ...data });
    } else {
      await createRisco.mutateAsync(data);
    }
  };

  const getCategoriaBadgeColor = (cat: CategoriaRisco) => {
    switch (cat) {
      case "Físico":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Químico":
        return "bg-red-100 text-red-800 border-red-300";
      case "Biológico":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Ergonômico":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Acidente":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Uma lista vazia com filtro ativo e um resultado de filtro, nao ausencia
  // de cadastro; a mensagem e a acao oferecida precisam ser diferentes.
  const temFiltroAtivo = searchTerm.trim().length > 0 || selectedCategoria !== "todos" || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedCategoria("todos");
    setSelectedStatus("todos");
  };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando ha dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: riscos.length === 0,
    modulo: "Catálogo de Riscos",
    onRetry: refetch,
    emptyTitulo: "Catálogo de riscos vazio",
    emptyDescricao:
      "PGR, APR e PT são montados a partir deste catálogo, então ele precisa existir antes do primeiro documento. " +
      "Você pode começar do catálogo padrão da construção civil e editar depois, ou cadastrar risco por risco.",
    emptyAction: allowEdit ? (
      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button
          onClick={() => popularCatalogoPadrao.mutate()}
          disabled={popularCatalogoPadrao.isPending}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {popularCatalogoPadrao.isPending
            ? "Preparando catálogo…"
            : `Usar catálogo padrão (${RISCOS_PADRAO.length} riscos)`}
        </Button>
        <Button variant="outline" onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" /> Cadastrar manualmente
        </Button>
      </div>
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
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            SGSST — Catálogo de Perigos e Riscos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro centralizado de riscos ocupacionais para utilização no PGR, APR, Inspeções e Incidentes.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Risco
          </Button>
        )}
      </div>

      {/* Indicadores — contagens sobre a base inteira, não sobre a página */}
      <SgsstStatCards
        isLoading={loadingResumo}
        stats={[
          {
            label: "Total de Riscos",
            value: count("total"),
            tone: "info",
            icon: AlertTriangle,
            ajuda: "Todos os riscos do catálogo, ativos e inativos.",
          },
          {
            label: "Riscos Ativos",
            value: count("ativos"),
            tone: "positivo",
            icon: CheckCircle2,
            ajuda: "Riscos disponíveis para uso em PGR, APR, PT e Inspeções.",
          },
          {
            label: "Físicos / Químicos",
            value: count("fisicoQuimico"),
            tone: "atencao",
            icon: Biohazard,
            ajuda: "Agentes que costumam exigir monitoramento quantitativo e entram no PCMSO.",
          },
          {
            label: "Ergonômicos / Acidentes",
            value: count("ergoAcidente"),
            tone: "neutro",
            icon: Activity,
            ajuda: "Riscos avaliados de forma qualitativa, típicos de análise ergonômica e APR.",
          },
        ]}
      />

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nome, código, agente ou fonte geradora..."
        resultCount={total}
        isLoading={isLoading}
        onClearAll={limparFiltros}
        activeFilters={[
          ...(selectedCategoria !== "todos"
            ? [
                {
                  label: "Categoria",
                  value: selectedCategoria,
                  onClear: () => setSelectedCategoria("todos"),
                },
              ]
            : []),
          ...(selectedStatus !== "todos"
            ? [
                {
                  label: "Status",
                  value: selectedStatus === "ativo" ? "Ativo" : "Inativo",
                  onClear: () => setSelectedStatus("todos"),
                },
              ]
            : []),
        ]}
      >
        <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por categoria de risco">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Categorias</SelectItem>
            <SelectItem value="Físico">Físico</SelectItem>
            <SelectItem value="Químico">Químico</SelectItem>
            <SelectItem value="Biológico">Biológico</SelectItem>
            <SelectItem value="Ergonômico">Ergonômico</SelectItem>
            <SelectItem value="Acidente">Acidente</SelectItem>
            <SelectItem value="Outros">Outros</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[130px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
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
                <TableHead>Nome do Risco / Perigo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Agente Nocivo</TableHead>
                <TableHead>Fonte Geradora</TableHead>
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
                riscos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {r.nome}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoriaBadgeColor(r.categoria)}>
                        {r.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {r.agente || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {r.fonte_geradora || "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === "ativo" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" /> Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(r)} title="Visualizar Detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>

                        {allowEdit && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir risco "{r.nome}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação removerá o risco do catálogo da empresa.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeRisco.mutate(r.id)}>
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
      <RiscosFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        risco={editingRisco}
        onSave={handleSave}
        isLoading={createRisco.isPending || updateRisco.isPending}
      />

      {/* Detail Dialog */}
      <RiscosDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        risco={viewingRisco}
      />
    </div>
  );
}
