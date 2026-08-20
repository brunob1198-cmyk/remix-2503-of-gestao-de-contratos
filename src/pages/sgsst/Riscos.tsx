import { useEffect, useState } from "react";
import { useSgsstRiscos, SgsstRisco, SgsstRiscoInput, CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { formatarLimite, limitePendente, TECNICA_LABEL } from "@/utils/sgsstRiscoLimite";
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
import { Plus, Edit2, Trash2, AlertTriangle, Eye, CheckCircle2, XCircle, Ruler, Biohazard, Sparkles } from "lucide-react";
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
  const [selectedTecnica, setSelectedTecnica] = useState<string>("todos");

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
      tecnica: selectedTecnica,
    });

  const {
    count,
    valorExibivel,
    indisponivel,
    indisponiveis,
    isLoading: loadingResumo,
  } = useSgsstCounts("sgsst_riscos_catalogo", [
    { key: "total" },
    { key: "ativos", build: (q) => q.eq("status", "ativo") },
    { key: "fisicoQuimico", build: (q) => q.in("categoria", ["Físico", "Químico"]) },
    // Pendencia acionavel, nao contagem descritiva: risco que exige medicao
    // instrumental mas nao tem limite contra o qual comparar o resultado.
    {
      key: "limitePendente",
      build: (q) => q.eq("tecnica_avaliacao", "QUANTITATIVA").is("limite_tolerancia", null),
    },
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, selectedCategoria, selectedStatus, selectedTecnica]);

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

  const handleSave = async (data: SgsstRiscoInput) => {
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
  const temFiltroAtivo =
    searchTerm.trim().length > 0 ||
    selectedCategoria !== "todos" ||
    selectedStatus !== "todos" ||
    selectedTecnica !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedCategoria("todos");
    setSelectedStatus("todos");
    setSelectedTecnica("todos");
  };

  const TECNICA_FILTRO_LABEL: Record<string, string> = {
    QUALITATIVA: "Qualitativa",
    QUANTITATIVA: "Quantitativa",
    pendente: "Sem limite definido",
    sem_tecnica: "Técnica não definida",
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
            value: valorExibivel("total"),
            tone: indisponivel("total") ? "neutro" : "info",
            icon: AlertTriangle,
            ajuda: "Todos os riscos do catálogo, ativos e inativos.",
          },
          {
            label: "Riscos Ativos",
            value: valorExibivel("ativos"),
            tone: indisponivel("ativos") ? "neutro" : "positivo",
            icon: CheckCircle2,
            ajuda: "Riscos disponíveis para uso em PGR, APR, PT e Inspeções.",
          },
          {
            label: "Físicos / Químicos",
            value: valorExibivel("fisicoQuimico"),
            tone: indisponivel("fisicoQuimico") ? "neutro" : "atencao",
            icon: Biohazard,
            ajuda: "Agentes que costumam exigir monitoramento quantitativo e entram no PCMSO.",
          },
          {
            label: "Sem limite definido",
            value: valorExibivel("limitePendente"),
            // Verde só quando a contagem foi feita e deu zero. Falha na contagem
            // vira cinza: pintar de verde um número que não existe passaria a
            // impressão oposta da verdadeira.
            tone: indisponivel("limitePendente")
              ? "neutro"
              : count("limitePendente") > 0
                ? "atencao"
                : "positivo",
            icon: Ruler,
            hint: indisponivel("limitePendente") ? "não foi possível contar" : "exigem medição",
            ajuda:
              "Riscos marcados como quantitativos que não têm limite de tolerância cadastrado. Sem limite, a medição existe mas não permite concluir se a exposição está conforme.",
          },
        ]}
      />

      {indisponiveis.length > 0 && !loadingResumo && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <strong>{indisponiveis.length} indicador(es) não pôde ser calculado</strong> e aparece
          como "—" acima. A causa mais comum é a migration{" "}
          <code className="font-mono">20260820140000_catalogo_riscos_limite_tolerancia.sql</code>{" "}
          ainda não ter sido aplicada ao banco: os campos de limite de tolerância e técnica de
          avaliação não existem lá. A lista de riscos abaixo continua funcionando.
        </p>
      )}

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
          ...(selectedTecnica !== "todos"
            ? [
                {
                  label: "Avaliação",
                  value: TECNICA_FILTRO_LABEL[selectedTecnica] ?? selectedTecnica,
                  onClear: () => setSelectedTecnica("todos"),
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

        <Select value={selectedTecnica} onValueChange={setSelectedTecnica}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por técnica de avaliação">
            <SelectValue placeholder="Avaliação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda avaliação</SelectItem>
            <SelectItem value="QUANTITATIVA">Quantitativa</SelectItem>
            <SelectItem value="QUALITATIVA">Qualitativa</SelectItem>
            <SelectItem value="pendente">Sem limite definido</SelectItem>
            <SelectItem value="sem_tecnica">Técnica não definida</SelectItem>
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
                <TableHead>Limite / Avaliação</TableHead>
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
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatarLimite(r.limite_tolerancia, r.unidade_medida) ? (
                        <span className="font-medium tabular-nums">
                          {formatarLimite(r.limite_tolerancia, r.unidade_medida)}
                        </span>
                      ) : limitePendente(r) ? (
                        <span
                          className="text-amber-700 dark:text-amber-500"
                          title="Risco quantitativo sem limite de tolerância cadastrado"
                        >
                          limite pendente
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {r.tecnica_avaliacao && (
                        <span className="block text-muted-foreground">
                          {TECNICA_LABEL[r.tecnica_avaliacao]}
                        </span>
                      )}
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
                                    O risco sai do catálogo e o vínculo com ele é desfeito em
                                    todo PGR, APR, PT, inspeção e incidente que o referenciava
                                    — as linhas continuam lá, mas deixam de apontar para o
                                    catálogo, e o limite de tolerância e a base legal param de
                                    acompanhar esses documentos. Para parar de oferecê-lo em
                                    novos documentos sem afetar os antigos, marque-o como
                                    inativo em vez de excluir.
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
