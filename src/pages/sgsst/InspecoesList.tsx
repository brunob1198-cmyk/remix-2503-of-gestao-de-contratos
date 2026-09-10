import { useMemo, useState } from "react";
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
import { Plus, Search, Edit2, Trash2, SearchCheck, Eye, CheckCircle2, XCircle, PlayCircle, Lock, Calendar, AlertTriangle } from "lucide-react";
import { InspecaoFormDialog } from "@/components/sgsst/InspecaoFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";
import { diasDeAtraso, situacaoDoPrazo } from "@/utils/sgsstInspecaoAtraso";

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

  // Hoje em ISO, calculado no fuso local. `toISOString()` converteria para UTC e
  // no Brasil devolveria o dia anterior à noite, marcando como atrasada uma
  // inspeção planejada para hoje.
  const hoje = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  // Indicadores sobre a base inteira: derivar da página corrente fazia os
  // cartões medirem apenas as linhas visíveis.
  //
  // "Atrasadas" e "Planejadas" são DISJUNTAS de propósito: se a planejada
  // continuasse contando as vencidas, o cartão que deveria denunciar o atraso
  // ficaria escondido dentro do que parece normal.
  const { count: countInsp } = useSgsstCounts("sgsst_inspecoes", [
    { key: "total" },
    { key: "concluidas", build: (q) => q.eq("status", "CONCLUIDA") },
    { key: "emExecucao", build: (q) => q.eq("status", "EM_EXECUCAO") },
    { key: "planejadas", build: (q) => q.eq("status", "PLANEJADA").gte("data_planejada", hoje) },
    { key: "atrasadas", build: (q) => q.eq("status", "PLANEJADA").lt("data_planejada", hoje) },
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

  /**
   * O selo da linha, considerando o prazo e não só o status.
   *
   * Recebe a inspeção inteira, e não o status: uma planejada cuja data já passou
   * aparecia idêntica a uma planejada para semana que vem. É a diferença entre
   * "está no plano" e "o plano não foi cumprido", e ela não estava em lugar nenhum
   * da tela. Ver `sgsstInspecaoAtraso.ts` para o porquê de execução além do prazo
   * ser um selo diferente de atrasada.
   */
  const getStatusBadge = (insp: Pick<SgsstInspecao, "status" | "data_planejada">) => {
    const situacao = situacaoDoPrazo({
      status: insp.status,
      dataPlanejada: insp.data_planejada,
      hoje,
    });

    if (situacao === "ATRASADA") {
      const dias = diasDeAtraso({ dataPlanejada: insp.data_planejada, hoje });
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 w-fit">
          <AlertTriangle className="h-3 w-3" />
          ATRASADA {dias === 1 ? "há 1 dia" : `há ${dias} dias`}
        </Badge>
      );
    }

    if (situacao === "EM_EXECUCAO_ALEM_DO_PRAZO") {
      return (
        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 flex items-center gap-1 w-fit">
          <PlayCircle className="h-3 w-3" /> EM EXECUÇÃO — ALÉM DO PRAZO
        </Badge>
      );
    }

    switch (insp.status) {
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
        // `insp.status`, e não `status`: sem o objeto isto resolvia para o global
        // `window.status` — uma string vazia que o TypeScript aceita sem reclamar,
        // e o selo sairia em branco para qualquer status novo.
        return <Badge variant="outline">{insp.status}</Badge>;
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
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Inspeções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countInsp("total")}</div>
          </CardContent>
        </Card>
        {/*
          Cartão de atrasadas: inspeção planejada cuja data passou e que ninguém
          executou. Antes desta mudança a palavra "atrasada" não existia em lugar
          nenhum do módulo — a inspeção vencida ficava entre as planejadas e o
          painel dava a entender que estava tudo em ordem.
          Fica logo depois do total, e não no fim, porque é o número que pede ação.
        */}
        <Card className={countInsp("atrasadas") > 0 ? "border-red-300 bg-red-50/50" : undefined}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              {countInsp("atrasadas") > 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${countInsp("atrasadas") > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {countInsp("atrasadas")}
            </div>
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
            {/* Diz o recorte, porque um número de "planejadas" que exclui as
                vencidas surpreende quem soma os cartões e não fecha com o total. */}
            <p className="text-xs text-muted-foreground mt-0.5">dentro do prazo</p>
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
                    <TableCell>{getStatusBadge(i)}</TableCell>
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
