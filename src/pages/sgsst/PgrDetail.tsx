import { useState } from "react";
import { SgsstBreadcrumb } from "@/components/sgsst/SgsstBreadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstPgr,
  useSgsstPgrDetail,
  useSgsstPgrInventario,
  useSgsstPgrMedidasControle,
  useSgsstPgrMedidasDoPgr,
  useSgsstPgrHistorico,
  useSgsstPgrInventarioFuncoes,
  OPERACAO_HISTORICO_LABEL,
  SgsstPgrInventario,
  SgsstPgrInventarioInput,
  SgsstPgrMedidaControle,
  SgsstPgrMedidaControleInput,
  StatusPgr,
} from "@/hooks/sgsst/useSgsstPgr";
import { PgrEmitirDialog } from "@/components/sgsst/PgrEmitirDialog";
import { PgrRevisaoAviso } from "@/components/sgsst/PgrRevisaoAviso";
import { alineasPendentes } from "@/utils/sgsstPgrInventario";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Edit2, Trash2, ShieldAlert, Wrench, AlertTriangle, CheckCircle2, Lock, FileCheck, Calendar, User, RefreshCw, History, FileDown, Users } from "lucide-react";
import { PgrInventarioFormDialog } from "@/components/sgsst/PgrInventarioFormDialog";
import { PgrMedidasFormDialog } from "@/components/sgsst/PgrMedidasFormDialog";
import { PgrFormDialog } from "@/components/sgsst/PgrFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstPgrDetailPage() {
  const { pgrId } = useParams<{ pgrId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pgr");

  const { updatePgr, updateStatusPgr } = useSgsstPgr();
  const { data: currentPgr, isLoading: loadingDetail } = useSgsstPgrDetail(pgrId);

  const { riscos: riscosCatalogo } = useSgsstRiscos();
  const { inventario, isLoading: loadingInventario, createInventarioItem, updateInventarioItem, removeInventarioItem } = useSgsstPgrInventario(pgrId);

  const [selectedInventarioId, setSelectedInventarioId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("inventario");
  const { medidas, isLoading: loadingMedidas, createMedida, updateMedida, removeMedida } = useSgsstPgrMedidasControle(selectedInventarioId || undefined);

  // Quadro de medidas do PGR inteiro, so para a contagem de implantadas por item:
  // a alinea "h" da NR-01 e satisfeita por medida implantada, e nao pelo texto
  // que saiu do formulario.
  const { implantadasDoItem } = useSgsstPgrMedidasDoPgr(inventario.map((i) => i.id));

  // Dialog States
  const [isEditPgrOpen, setIsEditPgrOpen] = useState(false);
  const [isInventarioFormOpen, setIsInventarioFormOpen] = useState(false);
  const [editingInventarioItem, setEditingInventarioItem] = useState<SgsstPgrInventario | null>(null);

  const [isMedidaFormOpen, setIsMedidaFormOpen] = useState(false);
  const [editingMedida, setEditingMedida] = useState<SgsstPgrMedidaControle | null>(null);
  const [isEmitirOpen, setIsEmitirOpen] = useState(false);

  const { historico, isLoading: loadingHistorico, error: erroHistorico } =
    useSgsstPgrHistorico(pgrId);
  const { funcoesDoItem, error: erroVinculos } = useSgsstPgrInventarioFuncoes(pgrId);

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentPgr) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Documento PGR não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/pgr")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isEncerrado = currentPgr.status === "ENCERRADO";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const getClassificacaoBadgeColor = (c?: string) => {
    switch (c) {
      case "BAIXO":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "MODERADO":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "ALTO":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "CRÍTICO":
        return "bg-red-100 text-red-800 border-red-300 font-bold";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoMedidaBadgeColor = (tipo: string) => {
    switch (tipo) {
      case "Eliminação":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Substituição":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Engenharia":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Administrativa":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "EPI":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Status transitions
  const handleStatusTransition = async (nextStatus: StatusPgr) => {
    await updateStatusPgr.mutateAsync({ id: currentPgr.id, status: nextStatus });
  };

  // Inventario actions
  const handleCreateInventario = () => {
    setEditingInventarioItem(null);
    setIsInventarioFormOpen(true);
  };

  const handleEditInventario = (item: SgsstPgrInventario) => {
    setEditingInventarioItem(item);
    setIsInventarioFormOpen(true);
  };

  const handleSaveInventario = async (
    data: SgsstPgrInventarioInput & { funcaoIds?: string[] }
  ) => {
    if (editingInventarioItem) {
      await updateInventarioItem.mutateAsync({ id: editingInventarioItem.id, ...data });
    } else {
      await createInventarioItem.mutateAsync(data);
    }
  };

  // Medidas actions
  const handleOpenMedidas = (item: SgsstPgrInventario) => {
    setSelectedInventarioId(item.id);
    // Levar para a aba junto. Sem isto o botao apenas marcava o risco
    // selecionado, a tela continuava no inventario, e nada parecia acontecer —
    // era preciso descobrir sozinho que a aba ao lado tinha mudado de conteudo.
    setAbaAtiva("medidas");
  };

  const handleCreateMedida = () => {
    setEditingMedida(null);
    setIsMedidaFormOpen(true);
  };

  const handleEditMedida = (medida: SgsstPgrMedidaControle) => {
    setEditingMedida(medida);
    setIsMedidaFormOpen(true);
  };

  const handleSaveMedida = async (data: SgsstPgrMedidaControleInput) => {
    if (editingMedida) {
      await updateMedida.mutateAsync({ id: editingMedida.id, ...data });
    } else {
      await createMedida.mutateAsync(data);
    }
  };

  return (
    <div className="space-y-6">
      <SgsstBreadcrumb moduloLabel="PGR" moduloPath="/medicoes/sgsst/pgr" itemTitle={currentPgr.titulo} />

      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/pgr")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos PGRs
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes do PGR</span>
      </div>

      {/* Header Info Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentPgr.codigo || "PGR"}
                </span>
                <Badge variant="outline" className="text-xs font-semibold">
                  Status: {currentPgr.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentPgr.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Obra: <strong>{currentPgr.projeto ? `[${currentPgr.projeto.codigo}] ${currentPgr.projeto.nome}` : "—"}</strong> | Canteiro/Site: <strong>{currentPgr.site ? currentPgr.site.nome : "Geral do Projeto"}</strong>
              </p>
            </div>

            {/* Emitir fica fora do bloco de edicao: consultar e imprimir o
                programa nao e edicao, e PGR encerrado tambem precisa ser
                impresso para a guarda de 20 anos. */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setIsEmitirOpen(true)}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> Emitir PDF
              </Button>
            </div>

            {/* Status Change Controls */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isEncerrado && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditPgrOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Dados
                  </Button>
                )}

                {currentPgr.status === "RASCUNHO" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusTransition("ATIVO")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Homologar & Ativar
                  </Button>
                )}

                {currentPgr.status === "ATIVO" && (
                  <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => handleStatusTransition("EM_REVISAO")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Abrir Revisão
                  </Button>
                )}

                {currentPgr.status === "EM_REVISAO" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusTransition("ATIVO")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Re-ativar PGR
                  </Button>
                )}

                {currentPgr.status !== "ENCERRADO" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Lock className="h-3.5 w-3.5 mr-1" /> Encerrar PGR
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Encerrar este PGR?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ao encerrar o PGR, ele ficará arquivado para conformidade legal e não poderá mais ser editado.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleStatusTransition("ENCERRADO")}>
                          Confirmar Encerramento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Data de Início:</span>
              <span className="font-semibold">{formatDateStr(currentPgr.data_inicio)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Última revisão:</span>
              <span className="font-semibold">
                {currentPgr.data_revisao ? formatDateStr(currentPgr.data_revisao) : "nenhuma"}
              </span>
              <PgrRevisaoAviso
                variante="linha"
                dataInicio={currentPgr.data_inicio}
                dataRevisao={currentPgr.data_revisao}
                periodicidadeMeses={currentPgr.periodicidade_revisao_meses}
                status={currentPgr.status}
              />
            </div>
            <div>
              <span className="text-muted-foreground block">Responsável Técnico:</span>
              <span className="font-semibold">{currentPgr.responsavel?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Total de Riscos:</span>
              <span className="font-semibold">{inventario.length} no inventário</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <PgrRevisaoAviso
        dataInicio={currentPgr.data_inicio}
        dataRevisao={currentPgr.data_revisao}
        periodicidadeMeses={currentPgr.periodicidade_revisao_meses}
        status={currentPgr.status}
      />

      {/* Main Content Tabs */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="inventario" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Inventário de Riscos ({inventario.length})
          </TabsTrigger>
          <TabsTrigger value="medidas" className="gap-2" disabled={!selectedInventarioId && inventario.length === 0}>
            <Wrench className="h-4 w-4" /> Medidas de Controle
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVENTÁRIO DE RISCOS */}
        <TabsContent value="inventario" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Inventário de Perigos e Riscos (NR-1)</h3>
              <p className="text-xs text-muted-foreground">
                Levantamento das atividades, agentes nocivos e matriz de probabilidade x severidade.
              </p>
            </div>
            {allowEdit && !isEncerrado && (
              <Button onClick={handleCreateInventario} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Incluir Risco no Inventário
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade / Setor</TableHead>
                    <TableHead>Perigo / Risco do Catálogo</TableHead>
                    <TableHead>Fonte / Consequência</TableHead>
                    <TableHead>Grupos expostos</TableHead>
                    <TableHead>Exposição</TableHead>
                    <TableHead>P × S</TableHead>
                    <TableHead>Matriz de Risco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInventario ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Carregando inventário de riscos...
                      </TableCell>
                    </TableRow>
                  ) : inventario.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum risco incluído neste PGR até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventario.map((item) => (
                      <TableRow
                        key={item.id}
                        className={selectedInventarioId === item.id ? "bg-muted/40 font-medium" : ""}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-xs sm:text-sm">{item.atividade}</span>
                            <span className="text-xs text-muted-foreground">{item.area?.nome || "Setor Geral"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-xs flex items-center gap-1.5">
                              {item.perigo}
                              {(() => {
                                // Mesma checagem do PDF: o item mostra quantas
                                // alineas da NR-01 1.5.7.3.2 ainda faltam, para
                                // o furo aparecer aqui e nao so na emissao.
                                const faltas = alineasPendentes({
                                  ...item,
                                  totalFuncoes: funcoesDoItem(item.id).length,
                                  medidasImplantadas: implantadasDoItem(item.id),
                                });
                                if (faltas.length === 0) return null;
                                return (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1 py-0"
                                    title={faltas
                                      .map((f) => `${f.alinea}) ${f.titulo}`)
                                      .join("\n")}
                                  >
                                    {faltas.length} alínea(s)
                                  </Badge>
                                );
                              })()}
                            </span>
                            {item.risco_catalogo && (
                              <span className="text-xs text-primary font-mono">
                                [{item.risco_catalogo.categoria}] {item.risco_catalogo.nome}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          <div><strong>Fonte:</strong> {item.fonte_geradora || "—"}</div>
                          <div><strong>Danos:</strong> {item.consequencia || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {(() => {
                            const funcoes = funcoesDoItem(item.id);
                            const nomes = funcoes
                              .map((f) => f.funcao?.nome)
                              .filter(Boolean)
                              .join(", ");
                            const extra = item.grupos_expostos?.trim();

                            if (erroVinculos) {
                              return (
                                <span
                                  className="text-muted-foreground"
                                  title="Não foi possível ler os grupos expostos. A migration 20260820160000 pode não estar aplicada."
                                >
                                  —
                                </span>
                              );
                            }

                            if (!nomes && !extra) {
                              return (
                                <span
                                  className="text-amber-700 dark:text-amber-500"
                                  title="A NR-01 1.5.7.3.2 pede quais grupos estão expostos; a quantidade sozinha não identifica ninguém"
                                >
                                  não identificados
                                </span>
                              );
                            }

                            return (
                              <span className="inline-flex items-start gap-1">
                                <Users className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                <span>
                                  {[nomes, extra].filter(Boolean).join(" · ")}
                                  <span className="block text-muted-foreground">
                                    {item.trabalhadores_expostos} trabalhador(es)
                                  </span>
                                </span>
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {item.tipo_exposicao ? (
                            <>
                              {item.tipo_exposicao === "HABITUAL"
                                ? "Habitual"
                                : item.tipo_exposicao === "OCASIONAL"
                                  ? "Ocasional"
                                  : "Eventual"}
                              {item.tempo_exposicao && (
                                <span className="block text-muted-foreground">
                                  {item.tempo_exposicao}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-500">
                              não caracterizada
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {item.probabilidade} × {item.severidade} = <strong>{(item.nivel_risco || item.probabilidade * item.severidade)}</strong>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getClassificacaoBadgeColor(item.classificacao)}>
                            {item.classificacao}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => handleOpenMedidas(item)}
                              title="Gerenciar Medidas de Controle"
                            >
                              <Wrench className="h-3.5 w-3.5 text-blue-500" /> Medidas
                            </Button>

                            {allowEdit && !isEncerrado && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEditInventario(item)} title="Editar Risco">
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
                                      <AlertDialogTitle>Remover risco do inventário?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação removerá este risco do inventário do PGR.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => removeInventarioItem.mutate(item.id)}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: MEDIDAS DE CONTROLE */}
        <TabsContent value="medidas" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Plano de Ação e Medidas de Controle</h3>
              <p className="text-xs text-muted-foreground">
                {selectedInventarioId
                  ? `Medidas vinculadas ao risco selecionado.`
                  : `Selecione um risco na aba de Inventário para visualizar e incluir medidas de controle.`}
              </p>
            </div>
            {allowEdit && !isEncerrado && selectedInventarioId && (
              <Button onClick={handleCreateMedida} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Medida de Controle
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Medida de Controle</TableHead>
                    <TableHead>Tipo (Hierarquia de Proteção)</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo Limite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acompanhamento</TableHead>
                    <TableHead>Aferição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedInventarioId ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Clique em "Medidas" no risco desejado na aba de Inventário para ver seu plano de ação.
                      </TableCell>
                    </TableRow>
                  ) : loadingMedidas ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Carregando medidas de controle...
                      </TableCell>
                    </TableRow>
                  ) : medidas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma medida de controle cadastrada para este risco.
                      </TableCell>
                    </TableRow>
                  ) : (
                    medidas.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium max-w-sm">{m.descricao}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getTipoMedidaBadgeColor(m.tipo)}>
                            {m.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{m.responsavel?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(m.prazo)}</TableCell>
                        <TableCell className="text-xs max-w-[180px]">
                          {m.forma_acompanhamento || (
                            <span
                              className="text-amber-700 dark:text-amber-500"
                              title="A NR-01 1.5.5.2 pede a forma de acompanhamento junto com a medida"
                            >
                              não definida
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {m.resultado_verificacao ? (
                            <>
                              <Badge
                                variant="outline"
                                className={
                                  m.resultado_verificacao === "EFICAZ"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                    : m.resultado_verificacao === "PARCIALMENTE_EFICAZ"
                                      ? "bg-amber-50 text-amber-800 border-amber-300 text-xs"
                                      : "bg-red-50 text-red-700 border-red-300 text-xs"
                                }
                              >
                                {m.resultado_verificacao === "EFICAZ"
                                  ? "Eficaz"
                                  : m.resultado_verificacao === "PARCIALMENTE_EFICAZ"
                                    ? "Parcial"
                                    : "Ineficaz"}
                              </Badge>
                              {m.data_verificacao && (
                                <span className="block text-muted-foreground">
                                  {formatDateStr(m.data_verificacao)}
                                </span>
                              )}
                            </>
                          ) : m.status === "implementado" ? (
                            <span
                              className="text-amber-700 dark:text-amber-500"
                              title="Implantar não é o mesmo que funcionar: a NR-01 1.5.5.2 pede a aferição do resultado"
                            >
                              não aferida
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isEncerrado && (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditMedida(m)} title="Editar Medida">
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
                                    <AlertDialogTitle>Excluir medida de controle?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação removerá a medida de controle selecionada.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeMedida.mutate(m.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* TAB 3: HISTÓRICO — NR-01 1.5.7.3.3 exige guarda de 20 anos com histórico */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <div>
            <h3 className="text-lg font-semibold">Histórico de alterações</h3>
            <p className="text-xs text-muted-foreground">
              A NR-01 1.5.7.3.3 exige a guarda do PGR e do seu histórico de atualizações por 20
              anos. O registro é feito pelo banco, então alteração vinda de qualquer caminho
              aparece aqui — e nenhum registro pode ser editado ou apagado.
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>O que</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHistorico ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando histórico...
                      </TableCell>
                    </TableRow>
                  ) : erroHistorico ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-8 text-center text-sm">
                        <p className="font-medium">Não foi possível ler o histórico</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          A migration <code className="font-mono">20260820160000</code> pode não
                          ter sido aplicada ao banco. O restante da tela continua funcionando.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : historico.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum registro ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs whitespace-nowrap tabular-nums">
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs">
                            {OPERACAO_HISTORICO_LABEL[h.operacao] ?? h.operacao}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{h.versao ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.usuario?.nome || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{h.observacao || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PgrEmitirDialog open={isEmitirOpen} onOpenChange={setIsEmitirOpen} pgr={currentPgr} />

      <PgrFormDialog
        open={isEditPgrOpen}
        onOpenChange={setIsEditPgrOpen}
        pgr={currentPgr}
        onSave={async (data) => {
          await updatePgr.mutateAsync({ id: currentPgr.id, ...data });
        }}
      />

      <PgrInventarioFormDialog
        open={isInventarioFormOpen}
        onOpenChange={setIsInventarioFormOpen}
        pgrId={currentPgr.id}
        inventarioItem={editingInventarioItem}
        riscosCatalogo={riscosCatalogo}
        funcoesVinculadas={
          editingInventarioItem
            ? funcoesDoItem(editingInventarioItem.id).map((f) => f.funcao_id)
            : []
        }
        medidasImplantadas={
          editingInventarioItem ? implantadasDoItem(editingInventarioItem.id) : 0
        }
        onSave={handleSaveInventario}
        isLoading={createInventarioItem.isPending || updateInventarioItem.isPending}
      />

      {selectedInventarioId && (
        <PgrMedidasFormDialog
          open={isMedidaFormOpen}
          onOpenChange={setIsMedidaFormOpen}
          inventarioId={selectedInventarioId}
          medida={editingMedida}
          onSave={handleSaveMedida}
          isLoading={createMedida.isPending || updateMedida.isPending}
        />
      )}
    </div>
  );
}
