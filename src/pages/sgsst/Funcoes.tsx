import { useEffect, useState } from "react";
import { useSgsstFuncoes, SgsstFuncao, SgsstFuncaoInput } from "@/hooks/sgsst/useSgsstFuncoes";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { useSgsstFuncaoVinculosResumo } from "@/hooks/sgsst/useSgsstFuncaoVinculos";
import { FuncaoVinculosDialog } from "@/components/sgsst/FuncaoVinculosDialog";
import { FuncaoResumoDialog, type AbaVinculo } from "@/components/sgsst/FuncaoResumoDialog";
import { FuncaoPendenciasPanel } from "@/components/sgsst/FuncaoPendenciasPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  CheckCircle2,
  XCircle,
  IdCard,
  Link2,
  Eye,
  AlertTriangle,
  GraduationCap,
  HardHat,
  ClipboardCheck,
} from "lucide-react";
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

  const { count, valorExibivel, indisponivel, isLoading: loadingResumo } = useSgsstCounts(
    "sgsst_funcoes",
    [
      { key: "total" },
      { key: "ativas", build: (q) => q.eq("status", "ativo") },
      { key: "comCbo", build: (q) => q.not("cbo", "is", null) },
    ]
  );

  // Contagem de vinculos por funcao, em consulta separada: se as tabelas de
  // ligacao ainda nao existirem no banco, a lista de funcoes continua abrindo.
  const vinculos = useSgsstFuncaoVinculosResumo(funcoes.map((f) => f.id));

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncao, setEditingFuncao] = useState<SgsstFuncao | null>(null);
  const [isVinculosOpen, setIsVinculosOpen] = useState(false);
  const [funcaoVinculos, setFuncaoVinculos] = useState<SgsstFuncao | null>(null);
  const [abaVinculos, setAbaVinculos] = useState<AbaVinculo>("riscos");
  const [isResumoOpen, setIsResumoOpen] = useState(false);
  const [funcaoResumo, setFuncaoResumo] = useState<SgsstFuncao | null>(null);

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

  const handleVinculos = (funcao: SgsstFuncao, aba: AbaVinculo = "riscos") => {
    setAbaVinculos(aba);
    setFuncaoVinculos(funcao);
    setIsVinculosOpen(true);
  };

  const handleResumo = (funcao: SgsstFuncao) => {
    setFuncaoResumo(funcao);
    setIsResumoOpen(true);
  };

  // Sai do resumo antes de abrir o outro diálogo: dois modais empilhados deixam
  // o de baixo inerte atrás do overlay, e o usuário fica sem saber por que os
  // cliques não respondem.
  const handleResumoEditar = (funcao: SgsstFuncao) => {
    setIsResumoOpen(false);
    handleEdit(funcao);
  };

  const handleResumoGerenciar = (funcao: SgsstFuncao, aba: AbaVinculo) => {
    setIsResumoOpen(false);
    handleVinculos(funcao, aba);
  };

  const handleSave = async (data: SgsstFuncaoInput) => {
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

  // Sobre a pagina exibida, nao sobre a base: o resumo de vinculos e consultado
  // para os ids da pagina. O texto de ajuda do cartao diz isso explicitamente.
  const semRiscoMapeado = vinculos.indisponivel
    ? 0
    : funcoes.filter((f) => vinculos.resumo(f.id).riscos === 0).length;

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
      "A função é o centro do SGSST: é nela que se define a quais riscos quem a exerce está " +
      "exposto e quais treinamentos e EPIs ela exige. Preenchido uma vez, serve ao PGR, ao " +
      "PCMSO, à matriz de treinamentos e ao eSocial S-2240.",
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

      <Tabs defaultValue="cadastro" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cadastro" className="gap-1.5">
            <Briefcase className="h-4 w-4" />
            Funções
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Pendências por função
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="space-y-4 mt-0">
      {/* Indicadores — contagens sobre a base inteira, não sobre a página */}
      <SgsstStatCards
        isLoading={loadingResumo}
        stats={[
          {
            label: "Total de Funções",
            value: valorExibivel("total"),
            tone: indisponivel("total") ? "neutro" : "info",
            icon: Briefcase,
            ajuda: "Todas as funções cadastradas, ativas e inativas.",
          },
          {
            label: "Funções Ativas",
            value: valorExibivel("ativas"),
            tone: indisponivel("ativas") ? "neutro" : "positivo",
            icon: CheckCircle2,
            ajuda: "Funções disponíveis para vincular a colaboradores.",
          },
          {
            label: "Com CBO Informado",
            value: valorExibivel("comCbo"),
            tone: indisponivel("comCbo")
              ? "neutro"
              : count("comCbo") < count("total")
                ? "atencao"
                : "positivo",
            icon: IdCard,
            hint:
              count("comCbo") < count("total")
                ? `${count("total") - count("comCbo")} sem CBO`
                : "exigido no eSocial",
            ajuda:
              "O CBO é obrigatório no envio ao eSocial; funções sem CBO travam a transmissão do S-2240.",
          },
          {
            label: "Sem risco mapeado",
            value: semRiscoMapeado,
            tone: semRiscoMapeado > 0 ? "atencao" : "positivo",
            icon: AlertTriangle,
            hint: "nesta página",
            ajuda:
              "Funções desta página que ainda não têm nenhum risco vinculado. Sem risco mapeado, o PGR e o PCMSO não têm de onde puxar a exposição de quem exerce a função. A contagem é da página exibida, não da base inteira.",
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
                <TableHead>Riscos · Treinamentos · EPIs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableState ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
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
                      {vinculos.indisponivel ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Não foi possível ler as tabelas de vínculo. A migration 20260820150000 pode não ter sido aplicada."
                        >
                          —
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 text-xs tabular-nums">
                          <span
                            className={
                              vinculos.resumo(f.id).riscos === 0
                                ? "inline-flex items-center gap-1 text-amber-700 dark:text-amber-500"
                                : "inline-flex items-center gap-1 text-muted-foreground"
                            }
                            title={
                              vinculos.resumo(f.id).riscos === 0
                                ? "Nenhum risco mapeado: o PGR e o PCMSO não têm de onde puxar a exposição desta função"
                                : "Riscos vinculados"
                            }
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {vinculos.resumo(f.id).riscos}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-muted-foreground"
                            title="Treinamentos exigidos"
                          >
                            <GraduationCap className="h-3 w-3" />
                            {vinculos.resumo(f.id).treinamentos}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-muted-foreground"
                            title="EPIs exigidos"
                          >
                            <HardHat className="h-3 w-3" />
                            {vinculos.resumo(f.id).epis}
                          </span>
                        </div>
                      )}
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Visivel tambem em modo leitura: consultar o que a funcao
                            exige nao e edicao. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResumo(f)}
                          title="Ver tudo sobre esta função"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVinculos(f)}
                          title="Riscos, treinamentos e EPIs desta função"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>

                        {allowEdit && (
                          <>
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
                                  Se houver colaborador vinculado, a exclusão é bloqueada pelo
                                  banco. Não havendo, a função sai e junto com ela os vínculos
                                  de risco, treinamento e EPI que você mapeou aqui — os
                                  cadastros de risco, treinamento e EPI em si permanecem. Para
                                  parar de oferecê-la em novos cadastros sem perder o
                                  mapeamento, marque-a como inativa.
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
        </TabsContent>

        <TabsContent value="pendencias" className="mt-0">
          <FuncaoPendenciasPanel />
        </TabsContent>
      </Tabs>

      {/* Modal Dialog */}
      <FuncaoFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        funcao={editingFuncao}
        onSave={handleSave}
        isLoading={createFuncao.isPending || updateFuncao.isPending}
      />

      <FuncaoVinculosDialog
        open={isVinculosOpen}
        onOpenChange={setIsVinculosOpen}
        funcao={funcaoVinculos}
        allowEdit={allowEdit}
        abaInicial={abaVinculos}
      />

      <FuncaoResumoDialog
        open={isResumoOpen}
        onOpenChange={setIsResumoOpen}
        funcao={funcaoResumo}
        allowEdit={allowEdit}
        onEditarDados={handleResumoEditar}
        onGerenciarVinculos={handleResumoGerenciar}
      />
    </div>
  );
}
