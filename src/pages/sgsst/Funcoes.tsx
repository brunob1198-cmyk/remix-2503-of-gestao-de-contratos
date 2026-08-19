import { useEffect, useState } from "react";
import { useSgsstFuncoes, SgsstFuncao } from "@/hooks/sgsst/useSgsstFuncoes";
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
import { Plus, Edit2, Trash2, Briefcase, CheckCircle2, XCircle, IdCard } from "lucide-react";
import { FuncaoFormDialog } from "@/components/sgsst/FuncaoFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstFuncoesPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-funcoes");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  // Busca e filtro agora rodam no servidor: filtrar no cliente atuava apenas
  // sobre a pagina carregada, escondendo funcoes que existiam nas outras.
  const { funcoes, total, isLoading, error, refetch, createFuncao, updateFuncao, removeFuncao } =
    useSgsstFuncoes({ page, pageSize, search: debouncedSearch, status: selectedStatus });

  const { count, isLoading: loadingResumo } = useSgsstCounts("sgsst_funcoes", [
    { key: "total" },
    { key: "ativas", build: (q) => q.eq("status", "ativo") },
    { key: "comCbo", build: (q) => q.not("cbo", "is", null) },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncao, setEditingFuncao] = useState<SgsstFuncao | null>(null);

  const totalPages = Math.ceil(total / pageSize) || 1;

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, selectedStatus]);

  const handleCreateNew = () => {
    setEditingFuncao(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (funcao: SgsstFuncao) => {
    setEditingFuncao(funcao);
    setIsDialogOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingFuncao) {
      await updateFuncao.mutateAsync({ id: editingFuncao.id, ...data });
    } else {
      await createFuncao.mutateAsync(data);
    }
  };

  // Uma lista vazia com filtro ativo e um resultado de filtro, nao ausencia
  // de cadastro; a mensagem e a acao oferecida precisam ser diferentes.
  const temFiltroAtivo = searchTerm.trim().length > 0 || selectedStatus !== "todos";

  const limparFiltros = () => {
    setSearchTerm("");
    setSelectedStatus("todos");
  };

  const STATUS_LABEL: Record<string, string> = { ativo: "Ativo", inativo: "Inativo" };

  // Distingue carregando / falha / vazio-por-filtro / vazio-de-verdade.
  // Retorna null quando ha dados e a tabela deve renderizar as linhas.
  const tableState = resolveTableState({
    isLoading,
    error,
    isEmpty: funcoes.length === 0,
    modulo: "Funções",
    onRetry: refetch,
    emptyTitulo: "Nenhuma função cadastrada",
    emptyDescricao:
      "As funções descrevem cargos e suas exposições a risco, e alimentam o PCMSO e a matriz de treinamentos.",
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
            <Briefcase className="h-6 w-6 text-primary" />
            SGSST — Gestão de Funções e Cargos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre as funções ocupacionais e CBOs para mapeamento de riscos e exames do SGSST.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Função
          </Button>
        )}
      </div>

      {/* Indicadores — contagens sobre a base inteira, não sobre a página */}
      <SgsstStatCards
        isLoading={loadingResumo}
        stats={[
          {
            label: "Total de Funções",
            value: count("total"),
            tone: "info",
            icon: Briefcase,
            ajuda: "Todas as funções cadastradas, ativas e inativas.",
          },
          {
            label: "Funções Ativas",
            value: count("ativas"),
            tone: "positivo",
            icon: CheckCircle2,
            ajuda: "Funções disponíveis para vincular a colaboradores.",
          },
          {
            label: "Com CBO Informado",
            value: count("comCbo"),
            tone: "neutro",
            icon: IdCard,
            hint: "exigido no eSocial",
            ajuda: "O CBO é obrigatório no envio ao eSocial; funções sem CBO travam a transmissão.",
          },
        ]}
      />

      {/* Busca e filtros */}
      <SgsstFilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nome da função ou CBO..."
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
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </SgsstFilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Função</TableHead>
                <TableHead>CBO</TableHead>
                <TableHead>Descrição / Atribuições</TableHead>
                <TableHead>Status</TableHead>
                {allowEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    {tableState}
                  </TableCell>
                </TableRow>
              ) : (
                funcoes.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.cbo || "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {f.descricao || "—"}
                    </TableCell>
                    <TableCell>
                      {f.status === "ativo" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" /> Inativo
                        </Badge>
                      )}
                    </TableCell>
                    {allowEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} title="Editar">
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
                                <AlertDialogTitle>Excluir função "{f.nome}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação removerá a função. Caso haja colaboradores vinculados, a exclusão será bloqueada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeFuncao.mutate(f.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
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

      {/* Modal Dialog */}
      <FuncaoFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        funcao={editingFuncao}
        onSave={handleSave}
        isLoading={createFuncao.isPending || updateFuncao.isPending}
      />
    </div>
  );
}
