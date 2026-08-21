import { useState } from "react";
import { SgsstBreadcrumb } from "@/components/sgsst/SgsstBreadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstApr,
  useSgsstAprDetail,
  useSgsstAprEtapas,
  useSgsstAprRiscos,
  useSgsstAprMedidas,
  useSgsstAprParticipantes,
  useSgsstAprHistorico,
  SgsstAprEtapa,
  SgsstAprRisco,
  SgsstAprMedida,
  StatusApr,
} from "@/hooks/sgsst/useSgsstApr";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { useSgsstAprArvore } from "@/hooks/sgsst/useSgsstArvoreRiscos";
import { gerarPdfApr, pendenciasApr } from "@/lib/aprDocumento";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ListOrdered,
  AlertTriangle,
  Wrench,
  Users,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  RefreshCw,
  Send,
  FileDown,
  Loader2,
} from "lucide-react";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { AprFormDialog } from "@/components/sgsst/AprFormDialog";
import { AprEtapaFormDialog } from "@/components/sgsst/AprEtapaFormDialog";
import { AprRiscoFormDialog } from "@/components/sgsst/AprRiscoFormDialog";
import { AprStatusDialog } from "@/components/sgsst/AprStatusDialog";
import { PgrMedidasFormDialog } from "@/components/sgsst/PgrMedidasFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstAprDetailPage() {
  const { aprId } = useParams<{ aprId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-apr");

  const { updateApr, updateStatusApr } = useSgsstApr();
  const { data: currentApr, isLoading: loadingDetail } = useSgsstAprDetail(aprId);
  const { empresa } = useEmpresaAtual();
  const { profile } = useAuth();

  // A tela navega por etapa selecionada; o documento precisa da arvore inteira.
  // Emitir com o que esta na tela produziria uma APR com os riscos de uma unica
  // etapa, em silencio.
  const arvore = useSgsstAprArvore(aprId);
  const [emitindo, setEmitindo] = useState(false);

  const { riscos: riscosCatalogo } = useSgsstRiscos();
  const { colaboradores } = useSgsstColaboradoresResumo();
  const { etapas, isLoading: loadingEtapas, createEtapa, updateEtapa, removeEtapa } = useSgsstAprEtapas(aprId);
  const { participantes, addParticipante, removeParticipante } = useSgsstAprParticipantes(aprId);

  const emitirPdf = async () => {
    if (!currentApr) return;

    const dadosDoDocumento = {
      apr: currentApr,
      etapas: arvore.etapas,
      riscos: arvore.riscos,
      medidas: arvore.medidas,
      participantes,
      empresa: empresa ?? null,
      geradoPor: profile?.nome ?? null,
    };

    const pendencias = pendenciasApr(dadosDoDocumento);
    if (pendencias.length > 0) {
      toast.warning(`APR com ${pendencias.length} pendência(s)`, {
        description: pendencias.slice(0, 3).join(" · "),
      });
    }

    setEmitindo(true);
    try {
      await gerarPdfApr(dadosDoDocumento);
    } catch (e) {
      toast.error(`Erro ao emitir a APR: ${(e as Error).message}`);
    } finally {
      setEmitindo(false);
    }
  };
  const { historico } = useSgsstAprHistorico(aprId);

  // Active Etapa for Riscos management
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);
  const { riscos, isLoading: loadingRiscos, createRisco, updateRisco, removeRisco } = useSgsstAprRiscos(selectedEtapaId || undefined);

  // Active Risco for Medidas management
  const [selectedRiscoId, setSelectedRiscoId] = useState<string | null>(null);
  const { medidas, isLoading: loadingMedidas, createMedida, updateMedida, removeMedida } = useSgsstAprMedidas(selectedRiscoId || undefined);

  // Dialog States
  const [isEditAprOpen, setIsEditAprOpen] = useState(false);
  const [isEtapaFormOpen, setIsEtapaFormOpen] = useState(false);
  const [editingEtapaItem, setEditingEtapaItem] = useState<SgsstAprEtapa | null>(null);

  const [isRiscoFormOpen, setIsRiscoFormOpen] = useState(false);
  const [editingRiscoItem, setEditingRiscoItem] = useState<SgsstAprRisco | null>(null);

  const [isMedidaFormOpen, setIsMedidaFormOpen] = useState(false);
  const [editingMedida, setEditingMedida] = useState<SgsstAprMedida | null>(null);

  // Status Change Dialog State
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusApr>("EM_ANALISE");

  // Participante Dialog State
  const [isAddParticipanteOpen, setIsAddParticipanteOpen] = useState(false);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("");
  const [participacaoTexto, setParticipacaoTexto] = useState("Executante");

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentApr) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Documento APR não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/apr")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentApr.status === "APROVADA" || currentApr.status === "CANCELADA" || currentApr.status === "ENCERRADA";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm");
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

  const openStatusModal = (status: StatusApr) => {
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusApr.mutateAsync({
      id: currentApr.id,
      statusAnterior: currentApr.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  // Etapa actions
  const handleCreateEtapa = () => {
    setEditingEtapaItem(null);
    setIsEtapaFormOpen(true);
  };

  const handleEditEtapa = (etapa: SgsstAprEtapa) => {
    setEditingEtapaItem(etapa);
    setIsEtapaFormOpen(true);
  };

  const handleSaveEtapa = async (data: any) => {
    if (editingEtapaItem) {
      await updateEtapa.mutateAsync({ id: editingEtapaItem.id, ...data });
    } else {
      await createEtapa.mutateAsync(data);
    }
  };

  // Risco actions
  const handleOpenRiscos = (etapa: SgsstAprEtapa) => {
    setSelectedEtapaId(etapa.id);
  };

  const handleCreateRisco = () => {
    setEditingRiscoItem(null);
    setIsRiscoFormOpen(true);
  };

  const handleEditRisco = (r: SgsstAprRisco) => {
    setEditingRiscoItem(r);
    setIsRiscoFormOpen(true);
  };

  const handleSaveRisco = async (data: any) => {
    if (editingRiscoItem) {
      await updateRisco.mutateAsync({ id: editingRiscoItem.id, ...data });
    } else {
      await createRisco.mutateAsync(data);
    }
  };

  // Medida actions
  const handleOpenMedidas = (r: SgsstAprRisco) => {
    setSelectedRiscoId(r.id);
  };

  const handleCreateMedida = () => {
    setEditingMedida(null);
    setIsMedidaFormOpen(true);
  };

  const handleEditMedida = (m: SgsstAprMedida) => {
    setEditingMedida(m);
    setIsMedidaFormOpen(true);
  };

  const handleSaveMedida = async (data: any) => {
    if (editingMedida) {
      await updateMedida.mutateAsync({ id: editingMedida.id, ...data });
    } else {
      await createMedida.mutateAsync(data);
    }
  };

  // Add participante
  const handleAddParticipanteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaboradorId) return;

    const colab = colaboradores.find((c) => c.id === selectedColaboradorId);
    await addParticipante.mutateAsync({
      colaborador_dados_id: selectedColaboradorId,
      funcao_id: (colab as any)?.funcao_id ?? null,
      participacao: participacaoTexto,
    });

    setIsAddParticipanteOpen(false);
    setSelectedColaboradorId("");
  };

  return (
    <div className="space-y-6">
      <SgsstBreadcrumb moduloLabel="APR" moduloPath="/medicoes/sgsst/apr" itemTitle={currentApr.titulo} />

      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/apr")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar às APRs
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes da APR</span>
      </div>

      {/* Summary Header Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentApr.codigo || "APR"}
                </span>
                <Badge variant="outline" className="text-xs font-semibold">
                  Status: {currentApr.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentApr.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Atividade: <strong>{currentApr.atividade}</strong> | Obra: <strong>{currentApr.projeto ? `[${currentApr.projeto.codigo}] ${currentApr.projeto.nome}` : "—"}</strong>
              </p>
            </div>

            {/* Emitir fica fora do allowEdit: emitir e leitura. */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={emitirPdf}
                disabled={emitindo || arvore.isLoading}
                title="Emitir a APR em PDF"
              >
                {emitindo ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                )}
                Emitir APR
              </Button>
            </div>

            {/* Workflow Approval Action Buttons */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditAprOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar APR
                  </Button>
                )}

                {currentApr.status === "RASCUNHO" && (
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openStatusModal("EM_ANALISE")}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submeter para Análise
                  </Button>
                )}

                {currentApr.status === "EM_ANALISE" && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openStatusModal("APROVADA")}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar APR
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openStatusModal("REJEITADA")}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                    </Button>
                  </>
                )}

                {currentApr.status === "REJEITADA" && (
                  <Button size="sm" variant="outline" onClick={() => openStatusModal("RASCUNHO")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retornar p/ Edição
                  </Button>
                )}

                {currentApr.status === "APROVADA" && (
                  <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => openStatusModal("EM_ANALISE")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reabrir para Revisão
                  </Button>
                )}

                {currentApr.status !== "ENCERRADA" && currentApr.status !== "CANCELADA" && (
                  <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => openStatusModal("ENCERRADA")}>
                    <Lock className="h-3.5 w-3.5 mr-1" /> Encerrar
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Data de Elaboração:</span>
              <span className="font-semibold">{formatDateStr(currentApr.data)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Validade:</span>
              <span className="font-semibold">{formatDateStr(currentApr.validade)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Elaborador / Responsável:</span>
              <span className="font-semibold">{currentApr.responsavel?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Equipe Executante:</span>
              <span className="font-semibold">{participantes.length} colaboradores</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="etapas" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="etapas" className="gap-2">
            <ListOrdered className="h-4 w-4" /> Etapas & Riscos ({etapas.length})
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-2">
            <Users className="h-4 w-4" /> Equipe ({participantes.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ETAPAS, RISCOS E MEDIDAS DE CONTROLE */}
        <TabsContent value="etapas" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Desdobramento em Etapas da Tarefa</h3>
              <p className="text-xs text-muted-foreground">
                Identificação de perigos e ações preventivas passo a passo da operação.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={handleCreateEtapa} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Etapa da Tarefa
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {loadingEtapas ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando etapas da APR...</CardContent></Card>
            ) : etapas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma etapa cadastrada para esta APR.</CardContent></Card>
            ) : (
              etapas.map((etapa) => (
                <Card key={etapa.id} className={selectedEtapaId === etapa.id ? "border-primary shadow-sm" : ""}>
                  <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm bg-primary text-primary-foreground h-7 w-7 rounded-full flex items-center justify-center">
                        {etapa.ordem}
                      </span>
                      <div>
                        <CardTitle className="text-base font-semibold">{etapa.descricao}</CardTitle>
                        {etapa.responsavel && (
                          <span className="text-xs text-muted-foreground">Encarregado: {etapa.responsavel.nome}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={selectedEtapaId === etapa.id ? "default" : "outline"}
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => handleOpenRiscos(etapa)}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Ver Riscos
                      </Button>

                      {allowEdit && !isReadOnly && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEditEtapa(etapa)} title="Editar Etapa">
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
                                <AlertDialogTitle>Excluir etapa {etapa.ordem}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Todos os riscos e medidas de controle vinculados a esta etapa serão excluídos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeEtapa.mutate(etapa.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </CardHeader>

                  {/* Section for Riscos of Selected Etapa */}
                  {selectedEtapaId === etapa.id && (
                    <CardContent className="pt-4 border-t space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Riscos Mapeados na Etapa {etapa.ordem}
                        </span>
                        {allowEdit && !isReadOnly && (
                          <Button size="sm" variant="outline" onClick={handleCreateRisco} className="text-xs gap-1">
                            <Plus className="h-3.5 w-3.5" /> Adicionar Risco à Etapa
                          </Button>
                        )}
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Perigo / Fator</TableHead>
                            <TableHead>Risco Associado</TableHead>
                            <TableHead>Consequência</TableHead>
                            <TableHead>Matriz P × S</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingRiscos ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs">Carregando riscos...</TableCell></TableRow>
                          ) : riscos.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">Nenhum risco cadastrado nesta etapa.</TableCell></TableRow>
                          ) : (
                            riscos.map((r) => (
                              <TableRow key={r.id} className={selectedRiscoId === r.id ? "bg-muted/50" : ""}>
                                <TableCell className="font-medium text-xs">{r.perigo}</TableCell>
                                <TableCell className="text-xs">{r.risco}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.consequencia || "—"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs">{r.probabilidade}×{r.severidade}</span>
                                    <Badge variant="outline" className={getClassificacaoBadgeColor(r.classificacao)}>
                                      {r.classificacao}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs gap-1"
                                      onClick={() => handleOpenMedidas(r)}
                                      title="Gerenciar Medidas"
                                    >
                                      <Wrench className="h-3.5 w-3.5 text-blue-500" /> Medidas
                                    </Button>
                                    {allowEdit && !isReadOnly && (
                                      <>
                                        <Button variant="ghost" size="icon" onClick={() => handleEditRisco(r)} title="Editar Risco">
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <SgsstConfirmDelete
                                    alvo="este risco da etapa"
                                    consequencia={"O risco sai desta etapa da APR, junto com sua avaliação de severidade e probabilidade. As medidas de controle vinculadas também são removidas."}
                                    onConfirm={() => removeRisco.mutate(r.id)}
                                  />
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>

                      {/* Section for Medidas of Selected Risco */}
                      {selectedRiscoId && riscos.some((r) => r.id === selectedRiscoId) && (
                        <div className="bg-muted/30 p-3 rounded-md border space-y-3 mt-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                              <Wrench className="h-4 w-4 text-blue-500" /> Medidas de Controle do Risco Selecionado
                            </span>
                            {allowEdit && !isReadOnly && (
                              <Button size="sm" variant="default" onClick={handleCreateMedida} className="text-xs gap-1">
                                <Plus className="h-3.5 w-3.5" /> Nova Medida
                              </Button>
                            )}
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Medida de Controle</TableHead>
                                <TableHead className="text-xs">Hierarquia</TableHead>
                                <TableHead className="text-xs">Responsável</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-right text-xs">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loadingMedidas ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs">Carregando medidas...</TableCell></TableRow>
                              ) : medidas.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">Nenhuma medida cadastrada para este risco.</TableCell></TableRow>
                              ) : (
                                medidas.map((m) => (
                                  <TableRow key={m.id}>
                                    <TableCell className="text-xs font-medium">{m.descricao}</TableCell>
                                    <TableCell className="text-xs"><Badge variant="outline">{m.tipo}</Badge></TableCell>
                                    <TableCell className="text-xs">{m.responsavel?.nome || "—"}</TableCell>
                                    <TableCell className="text-xs"><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                      {allowEdit && !isReadOnly && (
                                        <div className="flex items-center justify-end gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => handleEditMedida(m)} title="Editar"><Edit2 className="h-4 w-4" /></Button>
                                          <SgsstConfirmDelete
                                    alvo="esta medida de controle"
                                    consequencia={"A medida deixa de constar como controle deste risco, e o risco residual da APR passa a ser avaliado sem ela."}
                                    onConfirm={() => removeMedida.mutate(m.id)}
                                  />
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: EQUIPE & PARTICIPANTES */}
        <TabsContent value="equipe" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Equipe e Participantes da APR</h3>
              <p className="text-xs text-muted-foreground">
                Trabalhadores e encarregados cientificados e autorizados para a execução.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddParticipanteOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Vincular Colaborador
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador / Trabalhador</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Função SGSST</TableHead>
                    <TableHead>Atuação na APR</TableHead>
                    <TableHead>Ciência / Confirmação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum colaborador vinculado a esta APR.
                      </TableCell>
                    </TableRow>
                  ) : (
                    participantes.map((p) => {
                      const nomeColab = p.colaborador_dados?.profile?.nome || p.colaborador_dados?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{nomeColab}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.colaborador_dados?.matricula || "—"}</TableCell>
                          <TableCell className="text-xs">{p.funcao?.nome || "—"}</TableCell>
                          <TableCell className="text-xs">{p.participacao || "Executante"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Cientificado
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {allowEdit && !isReadOnly && (
                              <SgsstConfirmDelete
                                    alvo="este participante"
                                    consequencia={"O trabalhador deixa de constar como ciente desta APR; o registro de participação é perdido."}
                                    onConfirm={() => removeParticipante.mutate(p.id)}
                                  />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HISTÓRICO DE APROVAÇÃO */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Histórico de Transições e Aprovações</h3>
              <p className="text-xs text-muted-foreground">
                Rastreabilidade de pareceres técnicos, submissões e alterações de status.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Usuário Responsável</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Parecer / Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum histórico registrado até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                        <TableCell className="font-medium text-xs">{h.usuario?.nome || "Sistema"}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Início"}</Badge></TableCell>
                        <TableCell className="text-xs"><Badge variant="outline" className="font-semibold">{h.novo_status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm">{h.observacao || "—"}</TableCell>
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
      <AprFormDialog
        open={isEditAprOpen}
        onOpenChange={setIsEditAprOpen}
        apr={currentApr}
        onSave={async (data) => {
          await updateApr.mutateAsync({ id: currentApr.id, ...data });
        }}
      />

      <AprEtapaFormDialog
        open={isEtapaFormOpen}
        onOpenChange={setIsEtapaFormOpen}
        aprId={currentApr.id}
        etapa={editingEtapaItem}
        nextOrdem={etapas.length + 1}
        onSave={handleSaveEtapa}
        isLoading={createEtapa.isPending || updateEtapa.isPending}
      />

      {selectedEtapaId && (
        <AprRiscoFormDialog
          open={isRiscoFormOpen}
          onOpenChange={setIsRiscoFormOpen}
          etapaId={selectedEtapaId}
          riscoItem={editingRiscoItem}
          riscosCatalogo={riscosCatalogo}
          onSave={handleSaveRisco}
          isLoading={createRisco.isPending || updateRisco.isPending}
        />
      )}

      {selectedRiscoId && (
        <PgrMedidasFormDialog
          open={isMedidaFormOpen}
          onOpenChange={setIsMedidaFormOpen}
          inventarioId={selectedRiscoId}
          medida={editingMedida as any}
          onSave={handleSaveMedida as any}
          isLoading={createMedida.isPending || updateMedida.isPending}
        />
      )}

      <AprStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentApr.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusApr.isPending}
      />

      {/* Modal Adicionar Participante */}
      <Dialog open={isAddParticipanteOpen} onOpenChange={setIsAddParticipanteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Vincular Colaborador a esta APR</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddParticipanteSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="colab">Colaborador Executante *</Label>
              <Select value={selectedColaboradorId} onValueChange={setSelectedColaboradorId}>
                <SelectTrigger id="colab">
                  <SelectValue placeholder="Selecione o colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayNome} {c.funcao ? `(${c.funcao})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="part">Papel / Atuação na Tarefa</Label>
              <Input
                id="part"
                placeholder="Ex: Executante, Encarregado, Operador de Máquina"
                value={participacaoTexto}
                onChange={(e) => setParticipacaoTexto(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddParticipanteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectedColaboradorId}>
                Adicionar Participante
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
