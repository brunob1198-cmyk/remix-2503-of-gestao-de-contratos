import { useState } from "react";
import { SgsstEvidenciasPanel } from "@/components/sgsst/SgsstEvidenciasPanel";
import { SgsstBreadcrumb } from "@/components/sgsst/SgsstBreadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstPt,
  useSgsstPtDetail,
  useSgsstPtChecklist,
  useSgsstPtRiscos,
  useSgsstPtParticipantes,
  useSgsstPtHistorico,
  useSgsstPtAtmosfera,
  PAPEIS_ESPACO_CONFINADO,
  PAPEIS_PT_GERAIS,
  StatusPt,
  SgsstPtChecklistItem,
} from "@/hooks/sgsst/useSgsstPt";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { gerarPdfPt, pendenciasPt } from "@/lib/ptDocumento";
import { useSgsstPtMedidasDaPt } from "@/hooks/sgsst/useSgsstArvoreRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PtAtmosferaPanel } from "@/components/sgsst/PtAtmosferaPanel";
import { avaliarLiberacaoEntrada } from "@/utils/sgsstAtmosfera";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wind,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  RefreshCw,
  Send,
  PlayCircle,
  PauseCircle,
  ClipboardCheck,
  FileCheck,
  Users,
  History,
  AlertTriangle,
  FileDown,
  Loader2,
  Camera,
} from "lucide-react";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { PtFormDialog } from "@/components/sgsst/PtFormDialog";
import { PtStatusDialog } from "@/components/sgsst/PtStatusDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstPtDetailPage() {
  const { ptId } = useParams<{ ptId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pt");

  const { updatePt, updateStatusPt } = useSgsstPt();
  const { data: currentPt, isLoading: loadingDetail } = useSgsstPtDetail(ptId);

  const { colaboradores } = useSgsstColaboradoresResumo();
  const { checklist, isLoading: loadingChecklist, updateRespostaItem, addChecklistItem, removeChecklistItem } = useSgsstPtChecklist(ptId);
  const { riscos, isLoading: loadingRiscos } = useSgsstPtRiscos(ptId);
  const { participantes, addParticipante, removeParticipante } = useSgsstPtParticipantes(ptId);
  const { medicoes: medicoesAtmosfera } = useSgsstPtAtmosfera(ptId);
  const { historico } = useSgsstPtHistorico(ptId);
  const { empresa } = useEmpresaAtual();
  const { profile } = useAuth();

  // As medidas de controle vivem penduradas em cada risco, e a tela carrega so as
  // do risco aberto. A folha precisa de todas: risco impresso sem a medida ao
  // lado informa o perigo e nao diz o que fazer a respeito.
  const { medidas: medidasDosRiscos } = useSgsstPtMedidasDaPt(riscos.map((r) => r.id));

  // Dialog States
  const [isEditPtOpen, setIsEditPtOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusPt>("EM_ANALISE");

  // Checklist Item State
  const [isAddChecklistOpen, setIsAddChecklistOpen] = useState(false);
  const [newItemTexto, setNewItemTexto] = useState("");
  const [newItemObrigatorio, setNewItemObrigatorio] = useState(true);

  // Emissao da PT. Fica fora do allowEdit: emitir e leitura, e quem confere no
  // local costuma nao ter permissao de editar.
  const [emitindo, setEmitindo] = useState(false);

  // Participante State
  const [isAddParticipanteOpen, setIsAddParticipanteOpen] = useState(false);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState("");
  const [responsabilidadeTexto, setResponsabilidadeTexto] = useState("Executante");

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentPt) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Permissão de Trabalho não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/pt")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentPt.status === "ENCERRADA" || currentPt.status === "CANCELADA";

  // A aba de atmosfera so aparece em espaco confinado: cobrar medicao de gases
  // numa PT de icamento seria ruido, e o usuario aprenderia a ignorar o aviso.
  const eEspacoConfinado = currentPt.tipo === "Espaço Confinado";

  const liberacaoEntrada = avaliarLiberacaoEntrada({
    medicoes: medicoesAtmosfera,
    responsabilidades: participantes.map((p) => p.responsabilidade),
    hoje: new Date(),
  });

  const temVigia = participantes.some(
    (p) => (p.responsabilidade ?? "").trim().toLowerCase() === "vigia"
  );

  // A folha da PT fica no local da atividade durante a execucao — e por isso a
  // emissao mora aqui, na tela onde a permissao e montada e liberada.
  const emitirPdf = async () => {
    const dadosDoDocumento = {
      pt: currentPt,
      riscos,
      medidas: medidasDosRiscos,
      checklist,
      participantes,
      medicoes: medicoesAtmosfera,
      empresa: empresa ?? null,
      geradoPor: profile?.nome ?? null,
    };

    // Pendencia nao impede a emissao: o documento sai marcando cada falta, e a
    // folha marcada e justamente o que faz a falta ser resolvida antes da entrada.
    const pendencias = pendenciasPt(dadosDoDocumento);
    if (pendencias.length > 0) {
      toast.warning(`PT com ${pendencias.length} pendência(s)`, {
        description: pendencias.slice(0, 3).join(" · "),
      });
    }

    setEmitindo(true);
    try {
      await gerarPdfPt(dadosDoDocumento);
    } catch (e) {
      toast.error(`Erro ao emitir a PT: ${(e as Error).message}`);
    } finally {
      setEmitindo(false);
    }
  };

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const openStatusModal = (status: StatusPt) => {
    // Espaco confinado sem avaliacao atmosferica aprovada e vigia designado: a
    // NR-33 nao diz "nao recomendado", diz que a entrada e PROIBIDA. Por isso
    // aqui bloqueia em vez de avisar — e a mensagem diz exatamente o que falta,
    // para o bloqueio ser acionavel e nao so um "nao".
    if (eEspacoConfinado && (status === "APROVADA" || status === "EM_EXECUCAO")) {
      if (!liberacaoEntrada.liberado) {
        toast.error(
          `Entrada em espaço confinado não liberada pela NR-33: ${liberacaoEntrada.impedimentos.join(
            " · "
          )}`,
          { duration: 12000 }
        );
        return;
      }
    }

    // Check if trying to approve but checklist mandatory items are non-conforme or pending
    if (status === "APROVADA") {
      const pendentesOuNaoConformes = checklist.filter(
        (c) => c.obrigatorio && (c.resposta === "Pendente" || c.resposta === "Não Conforme")
      );
      if (pendentesOuNaoConformes.length > 0) {
        toast.warning(
          `Atenção: Existem ${pendentesOuNaoConformes.length} item(ns) obrigatório(s) não conformes ou pendentes no checklist.`
        );
      }
    }
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusPt.mutateAsync({
      id: currentPt.id,
      statusAnterior: currentPt.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  const handleAddChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTexto.trim()) return;

    await addChecklistItem.mutateAsync({
      item: newItemTexto.trim(),
      obrigatorio: newItemObrigatorio,
    });

    setIsAddChecklistOpen(false);
    setNewItemTexto("");
  };

  const handleAddParticipanteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColaboradorId) return;

    const colab = colaboradores.find((c) => c.id === selectedColaboradorId);
    await addParticipante.mutateAsync({
      colaborador_dados_id: selectedColaboradorId,
      funcao_id: (colab as any)?.funcao_id ?? null,
      responsabilidade: responsabilidadeTexto,
    });

    setIsAddParticipanteOpen(false);
    setSelectedColaboradorId("");
  };

  return (
    <div className="space-y-6">
      <SgsstBreadcrumb moduloLabel="PT" moduloPath="/medicoes/sgsst/pt" itemTitle={`[${currentPt.codigo || "PT"}] ${currentPt.atividade}`} />

      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/pt")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar às PTs
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes da PT</span>
      </div>

      {/* Header Info Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentPt.codigo || "PT"}
                </span>
                <Badge variant="outline" className="text-xs font-semibold">
                  Tipo: {currentPt.tipo}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-muted">
                  Status: {currentPt.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentPt.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Atividade: <strong>{currentPt.atividade}</strong> | Obra: <strong>{currentPt.projeto ? `[${currentPt.projeto.codigo}] ${currentPt.projeto.nome}` : "—"}</strong> | Local: <strong>{currentPt.local_execucao || "Geral"}</strong>
              </p>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={emitirPdf}
                disabled={emitindo}
                title="Emitir a PT em PDF para afixar no local da atividade"
              >
                {emitindo ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                )}
                Emitir PT
              </Button>
            </div>

            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditPtOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Dados
                  </Button>
                )}

                {currentPt.status === "RASCUNHO" && (
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openStatusModal("EM_ANALISE")}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submeter para Análise
                  </Button>
                )}

                {currentPt.status === "EM_ANALISE" && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openStatusModal("APROVADA")}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar PT
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openStatusModal("REJEITADA")}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                    </Button>
                  </>
                )}

                {currentPt.status === "APROVADA" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openStatusModal("EM_EXECUCAO")}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Liberar Execução
                  </Button>
                )}

                {currentPt.status === "EM_EXECUCAO" && (
                  <>
                    <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-50" onClick={() => openStatusModal("SUSPENSA")}>
                      <PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspender
                    </Button>
                    <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => openStatusModal("ENCERRADA")}>
                      <Lock className="h-3.5 w-3.5 mr-1" /> Encerrar Trabalhos
                    </Button>
                  </>
                )}

                {currentPt.status === "SUSPENSA" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openStatusModal("EM_EXECUCAO")}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Retomar Execução
                  </Button>
                )}

                {currentPt.status === "REJEITADA" && (
                  <Button size="sm" variant="outline" onClick={() => openStatusModal("RASCUNHO")}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retornar p/ Edição
                  </Button>
                )}

                {!isReadOnly && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => openStatusModal("CANCELADA")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar PT
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Início da Validade:</span>
              <span className="font-semibold">{formatDateStr(currentPt.data_inicio)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Término da Validade:</span>
              <span className="font-semibold">{formatDateStr(currentPt.data_fim)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Supervisor Responsável:</span>
              <span className="font-semibold">{currentPt.responsavel?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">APR Vinculada:</span>
              <span className="font-semibold">{currentPt.apr ? currentPt.apr.titulo : "Nenhuma"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className={`grid w-full grid-cols-3 sm:w-auto ${eEspacoConfinado ? "sm:grid-cols-6" : "sm:grid-cols-5"}`}>
          <TabsTrigger value="fotos" className="gap-2">
            <Camera className="h-4 w-4" /> Fotos
          </TabsTrigger>
          {eEspacoConfinado && (
            <TabsTrigger value="atmosfera" className="gap-2">
              <Wind className="h-4 w-4" /> Atmosfera
              {!liberacaoEntrada.liberado && (
                <span
                  className="ml-0.5 h-2 w-2 rounded-full bg-red-500"
                  aria-label="entrada não liberada"
                />
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="checklist" className="gap-2">
            <ClipboardCheck className="h-4 w-4" /> Checklist ({checklist.length})
          </TabsTrigger>
          <TabsTrigger value="apr" className="gap-2">
            <FileCheck className="h-4 w-4" /> APR & Riscos
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-2">
            <Users className="h-4 w-4" /> Equipe ({participantes.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {eEspacoConfinado && (
          <TabsContent value="atmosfera" className="space-y-4 pt-4">
            <PtAtmosferaPanel
              ptId={currentPt.id}
              participantes={participantes}
              allowEdit={allowEdit && !isReadOnly}
            />
          </TabsContent>
        )}

        {/* TAB 1: CHECKLIST DE SEGURANÇA */}
        <TabsContent value="checklist" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Checklist Pré-Operacional de Segurança ({currentPt.tipo})</h3>
              <p className="text-xs text-muted-foreground">
                Verificação obrigatória dos itens de prevenção antes da liberação dos trabalhos.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddChecklistOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar Item ao Checklist
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item de Verificação</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingChecklist ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando checklist...</TableCell></TableRow>
                  ) : checklist.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum item no checklist.</TableCell></TableRow>
                  ) : (
                    checklist.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">{c.item}</TableCell>
                        <TableCell>
                          {c.obrigatorio ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Sim</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={c.resposta === "Conforme" ? "default" : "outline"}
                              className={c.resposta === "Conforme" ? "bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" : "h-7 text-xs"}
                              onClick={() => updateRespostaItem.mutate({ id: c.id, resposta: "Conforme" })}
                              disabled={isReadOnly || !allowEdit}
                            >
                              Conforme
                            </Button>
                            <Button
                              size="sm"
                              variant={c.resposta === "Não Conforme" ? "destructive" : "outline"}
                              className={c.resposta === "Não Conforme" ? "h-7 text-xs" : "h-7 text-xs"}
                              onClick={() => updateRespostaItem.mutate({ id: c.id, resposta: "Não Conforme" })}
                              disabled={isReadOnly || !allowEdit}
                            >
                              Não Conforme
                            </Button>
                            <Button
                              size="sm"
                              variant={c.resposta === "Não Aplicável" ? "secondary" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => updateRespostaItem.mutate({ id: c.id, resposta: "Não Aplicável" })}
                              disabled={isReadOnly || !allowEdit}
                            >
                              N/A
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.observacao || "—"}</TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isReadOnly && (
                            <SgsstConfirmDelete
                                alvo="este item do checklist"
                                consequencia={"O item de verificação sai da Permissão de Trabalho, junto com a resposta já registrada pelo emitente."}
                                onConfirm={() => removeChecklistItem.mutate(c.id)}
                              />
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

        {/* TAB 2: APR VINCULADA & RISCOS */}
        <TabsContent value="apr" className="space-y-4 pt-4">
          {currentPt.apr ? (
            <Card className="bg-muted/20 border-primary/40">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">APR Vinculada: {currentPt.apr.titulo}</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/apr/${currentPt.apr_id}`)}>
                    Ver APR Completa
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground text-xs">
                Esta PT não possui uma APR formalmente vinculada. Os riscos e controles foram mapeados diretamente na PT.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Riscos Específicos Mapeados na PT</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perigo / Fator</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Consequência</TableHead>
                    <TableHead>Nível P × S</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRiscos ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs">Carregando riscos...</TableCell></TableRow>
                  ) : riscos.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs text-muted-foreground">Nenhum risco específico cadastrado na PT.</TableCell></TableRow>
                  ) : (
                    riscos.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-xs">{r.perigo}</TableCell>
                        <TableCell className="text-xs">{r.risco}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.consequencia || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.probabilidade}×{r.severidade} = {r.nivel_risco}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: EQUIPE E PARTICIPANTES */}
        <TabsContent value="equipe" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Equipe e Trabalhadores Autorizados</h3>
              <p className="text-xs text-muted-foreground">
                Colaboradores instruídos e autorizados a atuar na atividade desta PT.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddParticipanteOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Autorizar Trabalhador
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador Autorizado</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Função SGSST</TableHead>
                    <TableHead>Responsabilidade na PT</TableHead>
                    <TableHead>Status Autorização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum colaborador autorizado nesta PT.
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
                          <TableCell className="text-xs">{p.responsabilidade || "Executante"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Autorizado
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {allowEdit && !isReadOnly && (
                              <SgsstConfirmDelete
                                alvo="este participante"
                                consequencia={"O trabalhador deixa de constar como autorizado nesta PT e sua ciência registrada é perdida."}
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

        {/* TAB 4: HISTÓRICO DE AUDITORIA */}
        <TabsContent value="historico" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Histórico de Liberação e Vistorias</h3>
              <p className="text-xs text-muted-foreground">
                Registro auditado de emissão, aprovação, liberação de campo, suspensão e encerramento.
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
                    <TableHead>Status Anterior</TableHead>
                    <TableHead>Novo Status</TableHead>
                    <TableHead>Parecer / Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum histórico registrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                        <TableCell className="font-medium text-xs">{h.usuario?.nome || "Sistema"}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Emissão"}</Badge></TableCell>
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
        {/* Evidencia fotografica. Nenhuma tela do SGSST tinha anexo de foto: o
            modulo registrava desvio em texto. */}
        <TabsContent value="fotos" className="space-y-4 pt-4">
          <SgsstEvidenciasPanel
            entidade="PT"
            entidadeId={ptId}
            permiteEditar={allowEdit}
            ajuda="Fotografe a condição do local antes da liberação: isolamento, sinalização, ventilação e os equipamentos de resgate no ponto."
          />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <PtFormDialog
        open={isEditPtOpen}
        onOpenChange={setIsEditPtOpen}
        pt={currentPt}
        onSave={async (data) => {
          await updatePt.mutateAsync({ id: currentPt.id, ...data });
        }}
      />

      <PtStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentPt.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusPt.isPending}
      />

      {/* Modal Adicionar Item ao Checklist */}
      <Dialog open={isAddChecklistOpen} onOpenChange={setIsAddChecklistOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Checklist da PT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddChecklistSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="itemTexto">Item de Verificação de Segurança *</Label>
              <Input
                id="itemTexto"
                placeholder="Ex: Verificação de vazamento nos cilindros de gás acetileno"
                value={newItemTexto}
                onChange={(e) => setNewItemTexto(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="obrig"
                checked={newItemObrigatorio}
                onChange={(e) => setNewItemObrigatorio(e.target.checked)}
                className="rounded border-gray-300 text-primary"
              />
              <Label htmlFor="obrig" className="text-xs cursor-pointer">
                Item Obrigatório para Liberação
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddChecklistOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newItemTexto.trim()}>
                Adicionar Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Participante */}
      <Dialog open={isAddParticipanteOpen} onOpenChange={setIsAddParticipanteOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Autorizar Trabalhador nesta PT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddParticipanteSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="colab">Colaborador *</Label>
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
              <Label htmlFor="resp">Responsabilidade / Papel</Label>
              {/* Datalist e nao Select: os papeis da norma viram atalho sem
                  impedir papel proprio da obra ("Observador de Incendio"). */}
              <Input
                id="resp"
                list="papeis-pt"
                placeholder="Ex: Executante, Vigia, Supervisor de Entrada"
                value={responsabilidadeTexto}
                onChange={(e) => setResponsabilidadeTexto(e.target.value)}
              />
              <datalist id="papeis-pt">
                {(eEspacoConfinado
                  ? [...PAPEIS_ESPACO_CONFINADO, ...PAPEIS_PT_GERAIS]
                  : PAPEIS_PT_GERAIS
                ).map((papel) => (
                  <option key={papel} value={papel} />
                ))}
              </datalist>
              {eEspacoConfinado && (
                <p className="text-xs text-muted-foreground">
                  A NR-33 exige um <strong>Vigia</strong> designado, do lado de fora, durante
                  toda a permanência. Sem ele a PT não pode ser aprovada.
                  {!temVigia && (
                    <span className="block text-amber-700 dark:text-amber-500">
                      Esta PT ainda não tem vigia designado.
                    </span>
                  )}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddParticipanteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectedColaboradorId}>
                Autorizar Trabalhador
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
