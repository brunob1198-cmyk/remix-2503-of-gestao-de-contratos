import { useState, useEffect } from "react";
import { SgsstBreadcrumb } from "@/components/sgsst/SgsstBreadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstIncidentes,
  useSgsstIncidentesDetail,
  useSgsstIncidenteEnvolvidos,
  useSgsstIncidenteInvestigacao,
  useSgsstIncidenteAcoes,
  useSgsstIncidenteHistorico,
  StatusIncidente,
  TipoEnvolvimento,
  PrioridadeAcao,
  StatusAcao,
  SgsstIncidenteAcao,
} from "@/hooks/sgsst/useSgsstIncidentes";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Siren,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Search,
  Users,
  CheckSquare,
  FileCheck,
  FileText,
  ShieldCheck,
  SearchCheck,
  History,
  AlertTriangle,
} from "lucide-react";
import { acoesPendentes, mensagemBloqueioEncerramento } from "@/utils/sgsstWorkflow";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { IncidenteFormDialog } from "@/components/sgsst/IncidenteFormDialog";
import { IncidenteAcaoFormDialog } from "@/components/sgsst/IncidenteAcaoFormDialog";
import { IncidenteStatusDialog } from "@/components/sgsst/IncidenteStatusDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstIncidentesDetailPage() {
  const { incidenteId } = useParams<{ incidenteId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-incidentes");

  const { updateIncidente, updateStatusIncidente } = useSgsstIncidentes();
  const { data: currentIncidente, isLoading: loadingDetail } = useSgsstIncidentesDetail(incidenteId);

  const { colaboradores } = useSgsstColaboradoresResumo();
  const { riscos: riscosCatalogo } = useSgsstRiscos();
  const { envolvidos, addEnvolvido, removeEnvolvido } = useSgsstIncidenteEnvolvidos(incidenteId);
  const { investigacao, saveInvestigacao, isLoading: loadingInv } = useSgsstIncidenteInvestigacao(incidenteId);
  const { acoes, addAcao, updateAcao, removeAcao, isLoading: loadingAcoes } = useSgsstIncidenteAcoes(incidenteId);
  const { historico } = useSgsstIncidenteHistorico(incidenteId);

  // State para Formulário de Investigação
  const [descInv, setDescInv] = useState("");
  const [fatosObs, setFatosObs] = useState("");
  const [causasImediatas, setCausasImediatas] = useState("");
  const [causasBasicas, setCausasBasicas] = useState("");
  const [causasRaiz, setCausasRaiz] = useState("");
  const [fatoresContrib, setFatoresContrib] = useState("");
  const [conclusaoInv, setConclusaoInv] = useState("");
  const [riscoCatId, setRiscoCatId] = useState<string>("none");

  useEffect(() => {
    if (investigacao) {
      setDescInv(investigacao.descricao_investigacao || "");
      setFatosObs(investigacao.fatos_observados || "");
      setCausasImediatas(investigacao.causas_imediatas || "");
      setCausasBasicas(investigacao.causas_basicas || "");
      setCausasRaiz(investigacao.causas_raiz || "");
      setFatoresContrib(investigacao.fatores_contribuintes || "");
      setConclusaoInv(investigacao.conclusao || "");
      setRiscoCatId(investigacao.risco_catalogo_id || "none");
    }
  }, [investigacao]);

  // Dialog States
  const [isEditIncOpen, setIsEditIncOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusIncidente>("EM_INVESTIGACAO");

  // Envolvido Dialog State
  const [isAddEnvolvidoOpen, setIsAddEnvolvidoOpen] = useState(false);
  const [selectedColabId, setSelectedColabId] = useState("");
  const [tipoEnvolvimento, setTipoEnvolvimento] = useState<TipoEnvolvimento>("Vítima");
  const [descEnvolvimento, setDescEnvolvimento] = useState("");

  // Acao Form Dialog State
  const [isAcaoFormOpen, setIsAcaoFormOpen] = useState(false);
  const [editingAcao, setEditingAcao] = useState<SgsstIncidenteAcao | null>(null);

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentIncidente) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Ocorrência não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/incidentes")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentIncidente.status === "ENCERRADO" || currentIncidente.status === "CANCELADO";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const openStatusModal = (status: StatusIncidente) => {
    if (status === "ENCERRADO") {
      const pendentes = acoesPendentes(acoes);
      if (pendentes.length > 0) {
        toast.error(mensagemBloqueioEncerramento(pendentes.length, "encerrar o incidente"));
        return;
      }
    }
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusIncidente.mutateAsync({
      id: currentIncidente.id,
      statusAnterior: currentIncidente.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  const handleSaveInvestigacaoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descInv.trim()) {
      toast.error("Informe a descrição da investigação.");
      return;
    }

    await saveInvestigacao.mutateAsync({
      incidente_id: currentIncidente.id,
      descricao_investigacao: descInv.trim(),
      fatos_observados: fatosObs.trim() || null,
      causas_imediatas: causasImediatas.trim() || null,
      causas_basicas: causasBasicas.trim() || null,
      causas_raiz: causasRaiz.trim() || null,
      fatores_contribuintes: fatoresContrib.trim() || null,
      conclusao: conclusaoInv.trim() || null,
      risco_catalogo_id: riscoCatId === "none" ? null : riscoCatId,
    });
  };

  const handleAddEnvolvidoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColabId) return;

    const colab = colaboradores.find((c) => c.id === selectedColabId);
    await addEnvolvido.mutateAsync({
      colaborador_dados_id: selectedColabId,
      funcao_id: (colab as any)?.funcao_id ?? null,
      tipo_envolvimento: tipoEnvolvimento,
      descricao: descEnvolvimento.trim() || undefined,
    });

    setIsAddEnvolvidoOpen(false);
    setSelectedColabId("");
    setDescEnvolvimento("");
  };

  const handleSaveAcao = async (data: any) => {
    if (editingAcao) {
      await updateAcao.mutateAsync({ id: editingAcao.id, ...data });
    } else {
      await addAcao.mutateAsync(data);
    }
  };

  return (
    <div className="space-y-6">
      <SgsstBreadcrumb moduloLabel="Incidentes" moduloPath="/medicoes/sgsst/incidentes" itemTitle={currentIncidente.titulo} />

      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/incidentes")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos Incidentes
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes da Ocorrência</span>
      </div>

      {/* Header Info Card */}
      <Card className="border-l-4 border-l-red-600">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentIncidente.codigo || "INC"}
                </span>
                <Badge variant="outline" className="text-xs font-semibold bg-red-50 text-red-700 border-red-200">
                  Tipo: {currentIncidente.tipo}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-amber-50 text-amber-800 border-amber-300">
                  Gravidade: {currentIncidente.gravidade}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-muted">
                  Status: {currentIncidente.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentIncidente.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Obra: <strong>{currentIncidente.projeto ? `[${currentIncidente.projeto.codigo}] ${currentIncidente.projeto.nome}` : "—"}</strong> | Canteiro: <strong>{currentIncidente.site ? currentIncidente.site.nome : "Geral"}</strong> | Local: <strong>{currentIncidente.local_ocorrencia || "Geral"}</strong>
              </p>
            </div>

            {/* Workflow Action Buttons */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditIncOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Ocorrência
                  </Button>
                )}

                {currentIncidente.status === "REGISTRADO" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openStatusModal("EM_INVESTIGACAO")}>
                    <Search className="h-3.5 w-3.5 mr-1" /> Iniciar Investigação
                  </Button>
                )}

                {currentIncidente.status === "EM_INVESTIGACAO" && (
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => openStatusModal("PLANO_ACAO")}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Elaborar Plano de Ação
                  </Button>
                )}

                {currentIncidente.status === "PLANO_ACAO" && (
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openStatusModal("EM_TRATAMENTO")}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Iniciar Tratamento
                  </Button>
                )}

                {(currentIncidente.status === "EM_TRATAMENTO" || currentIncidente.status === "PLANO_ACAO") && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openStatusModal("ENCERRADO")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Encerrar Incidente
                  </Button>
                )}

                {!isReadOnly && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => openStatusModal("CANCELADO")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar Incidente
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Data da Ocorrência:</span>
              <span className="font-semibold">{formatDateStr(currentIncidente.data_ocorrencia)} {currentIncidente.hora_ocorrencia ? `às ${currentIncidente.hora_ocorrencia.slice(0, 5)}` : ""}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Responsável pelo Registro:</span>
              <span className="font-semibold">{currentIncidente.responsavel_registro?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Pessoas Envolvidas:</span>
              <span className="font-semibold">{envolvidos.length} registrada(s)</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Ações Corretivas/Preventivas:</span>
              <span className="font-semibold">{acoes.length} registrada(s) ({acoes.filter(a => a.status === 'CONCLUIDA').length} concluídas)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="envolvidos" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-5">
          <TabsTrigger value="envolvidos" className="gap-2">
            <Users className="h-4 w-4" /> Envolvidos ({envolvidos.length})
          </TabsTrigger>
          <TabsTrigger value="investigacao" className="gap-2">
            <Search className="h-4 w-4" /> Causa Raiz & Investigação
          </TabsTrigger>
          <TabsTrigger value="acoes" className="gap-2">
            <CheckSquare className="h-4 w-4" /> Planos de Ação ({acoes.length})
          </TabsTrigger>
          <TabsTrigger value="origem" className="gap-2">
            <FileCheck className="h-4 w-4" /> Origem
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ENVOLVIDOS */}
        <TabsContent value="envolvidos" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pessoas e Colaboradores Envolvidos</h3>
              <p className="text-xs text-muted-foreground">
                Vítimas, testemunhas, comunicantes e responsáveis mapeados no evento.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddEnvolvidoOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Vincular Pessoa / Envolvido
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador / Pessoa</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Função SGSST</TableHead>
                    <TableHead>Papel no Evento</TableHead>
                    <TableHead>Descrição / Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envolvidos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma pessoa ou envolvido cadastrado neste incidente.</TableCell></TableRow>
                  ) : (
                    envolvidos.map((e) => {
                      const nomeColab = e.colaborador_dados?.profile?.nome || e.colaborador_dados?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{nomeColab}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{e.colaborador_dados?.matricula || "—"}</TableCell>
                          <TableCell className="text-xs">{e.funcao?.nome || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={e.tipo_envolvimento === "Vítima" ? "bg-red-50 text-red-700 border-red-200" : "bg-muted"}>
                              {e.tipo_envolvimento}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.descricao || "—"}</TableCell>
                          <TableCell className="text-right">
                            {allowEdit && !isReadOnly && (
                              <SgsstConfirmDelete
                                alvo="o vínculo deste envolvido"
                                consequencia={"O colaborador deixa de constar como envolvido neste incidente. O registro sai da investigação e da comunicação de acidente."}
                                onConfirm={() => removeEnvolvido.mutate(e.id)}
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

        {/* TAB 2: INVESTIGAÇÃO & CAUSA RAIZ */}
        <TabsContent value="investigacao" className="space-y-4 pt-4">
          <form onSubmit={handleSaveInvestigacaoSubmit} className="space-y-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" /> Análise Metodológica de Investigação (Causa Raiz & Fatores)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs sm:text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="descInv">Descrição da Investigação Técnica *</Label>
                  <Textarea
                    id="descInv"
                    placeholder="Resumo dos trabalhos de auditoria de campo, reconstituição do evento, entrevistas..."
                    rows={2}
                    value={descInv}
                    onChange={(e) => setDescInv(e.target.value)}
                    disabled={isReadOnly || !allowEdit}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fatos">Fatos Observados na Vistoria</Label>
                    <Textarea
                      id="fatos"
                      placeholder="Condições físicas e evidências objetivas constatadas..."
                      rows={2}
                      value={fatosObs}
                      onChange={(e) => setFatosObs(e.target.value)}
                      disabled={isReadOnly || !allowEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="causasImediatas">Causas Imediatas (Atos / Condições Inseguras)</Label>
                    <Textarea
                      id="causasImediatas"
                      placeholder="Ex: Falta de trava de segurança no gancho da grua..."
                      rows={2}
                      value={causasImediatas}
                      onChange={(e) => setCausasImediatas(e.target.value)}
                      disabled={isReadOnly || !allowEdit}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="causasBasicas">Causas Básicas (Fatores Pessoais / do Trabalho)</Label>
                    <Textarea
                      id="causasBasicas"
                      placeholder="Ex: Ausência de treinamento específico para a tarefa..."
                      rows={2}
                      value={causasBasicas}
                      onChange={(e) => setCausasBasicas(e.target.value)}
                      disabled={isReadOnly || !allowEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="causasRaiz">Causa Raiz (Análise dos 5 Porquês / Diagrama Ishkawa)</Label>
                    <Textarea
                      id="causasRaiz"
                      placeholder="Falha sistêmica primordial da gestão de SSST..."
                      rows={2}
                      value={causasRaiz}
                      onChange={(e) => setCausasRaiz(e.target.value)}
                      disabled={isReadOnly || !allowEdit}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fatores">Fatores Contribuintes</Label>
                    <Textarea
                      id="fatores"
                      placeholder="Condições de iluminação, chuva, ruído, pressão de prazo..."
                      rows={2}
                      value={fatoresContrib}
                      onChange={(e) => setFatoresContrib(e.target.value)}
                      disabled={isReadOnly || !allowEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="riscoCat">Risco do Catálogo Relacionado</Label>
                    <Select value={riscoCatId} onValueChange={setRiscoCatId} disabled={isReadOnly || !allowEdit}>
                      <SelectTrigger id="riscoCat">
                        <SelectValue placeholder="Selecione o risco do catálogo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Nenhum Risco Específico --</SelectItem>
                        {riscosCatalogo.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            [{r.categoria}] {r.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="conclusao">Conclusão Final da Comissão / Engenharia de Segurança</Label>
                  <Textarea
                    id="conclusao"
                    placeholder="Parecer técnico conclusivo..."
                    rows={2}
                    value={conclusaoInv}
                    onChange={(e) => setConclusaoInv(e.target.value)}
                    disabled={isReadOnly || !allowEdit}
                  />
                </div>

                {allowEdit && !isReadOnly && (
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={saveInvestigacao.isPending || !descInv.trim()}>
                      {saveInvestigacao.isPending ? "Salvando..." : "Salvar Análise de Investigação"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* TAB 3: PLANOS DE AÇÃO */}
        <TabsContent value="acoes" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Planos de Ação Corretiva e Preventiva (CAPA)</h3>
              <p className="text-xs text-muted-foreground">
                Medidas obrigatórias para bloquear a reincidência da causa raiz identificada.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button
                onClick={() => {
                  setEditingAcao(null);
                  setIsAcaoFormOpen(true);
                }}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Nova Ação Corretiva / Preventiva
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Ação</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAcoes ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando plano de ação...</TableCell></TableRow>
                  ) : acoes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma ação corretiva/preventiva cadastrada para este incidente.</TableCell></TableRow>
                  ) : (
                    acoes.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs max-w-xs">{a.descricao}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.tipo}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-semibold">{a.prioridade}</Badge></TableCell>
                        <TableCell className="text-xs">{a.responsavel?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(a.prazo)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-semibold">{a.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isReadOnly && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingAcao(a);
                                  setIsAcaoFormOpen(true);
                                }}
                                title="Editar Ação"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <SgsstConfirmDelete
                                alvo="esta ação corretiva"
                                consequencia={"A ação sai do plano de ação do incidente, junto com seu responsável e prazo. Incidentes só podem ser encerrados com o plano concluído."}
                                onConfirm={() => removeAcao.mutate(a.id)}
                              />
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

        {/* TAB 4: ORIGEM E VÍNCULOS */}
        <TabsContent value="origem" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> PGR Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentIncidente.pgr ? (
                  <div>
                    <span className="font-medium block">{currentIncidente.pgr.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/pgr/${currentIncidente.pgr_id}`)}>
                      Abrir PGR →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum PGR associado.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> APR Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentIncidente.apr ? (
                  <div>
                    <span className="font-medium block">{currentIncidente.apr.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/apr/${currentIncidente.apr_id}`)}>
                      Abrir APR →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma APR associada.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> PT Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentIncidente.pt ? (
                  <div>
                    <span className="font-medium block">{currentIncidente.pt.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/pt/${currentIncidente.pt_id}`)}>
                      Abrir PT →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma PT associada.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <SearchCheck className="h-4 w-4 text-primary" /> Inspeção Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentIncidente.inspecao ? (
                  <div>
                    <span className="font-medium block">{currentIncidente.inspecao.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/inspecoes/${currentIncidente.inspecao_id}`)}>
                      Abrir Inspeção →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma inspeção associada.</span>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 5: HISTÓRICO DE AUDITORIA */}
        <TabsContent value="historico" className="space-y-4 pt-4">
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
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum histórico registrado.</TableCell></TableRow>
                  ) : (
                    historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{formatDateStr(h.created_at)}</TableCell>
                        <TableCell className="font-medium text-xs">{h.usuario?.nome || "Sistema"}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Registro"}</Badge></TableCell>
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
      <IncidenteFormDialog
        open={isEditIncOpen}
        onOpenChange={setIsEditIncOpen}
        incidente={currentIncidente}
        onSave={async (data) => {
          await updateIncidente.mutateAsync({ id: currentIncidente.id, ...data });
        }}
      />

      <IncidenteStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentIncidente.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusIncidente.isPending}
      />

      <IncidenteAcaoFormDialog
        open={isAcaoFormOpen}
        onOpenChange={setIsAcaoFormOpen}
        incidenteId={currentIncidente.id}
        acao={editingAcao}
        onSave={handleSaveAcao}
        isLoading={addAcao.isPending || updateAcao.isPending}
      />

      {/* Modal Vincular Envolvido */}
      <Dialog open={isAddEnvolvidoOpen} onOpenChange={setIsAddEnvolvidoOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Vincular Pessoa / Envolvido na Ocorrência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEnvolvidoSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="colab">Colaborador / Trabalhador *</Label>
              <Select value={selectedColabId} onValueChange={setSelectedColabId}>
                <SelectTrigger id="colab">
                  <SelectValue placeholder="Selecione..." />
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
              <Label htmlFor="tipoEnv">Papel / Tipo de Envolvimento *</Label>
              <Select value={tipoEnvolvimento} onValueChange={(val: TipoEnvolvimento) => setTipoEnvolvimento(val)}>
                <SelectTrigger id="tipoEnv">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vítima">Vítima / Acidentado</SelectItem>
                  <SelectItem value="Testemunha">Testemunha Presencial</SelectItem>
                  <SelectItem value="Envolvido">Envolvido Direto</SelectItem>
                  <SelectItem value="Comunicante">Comunicante / Notificante</SelectItem>
                  <SelectItem value="Responsável">Responsável pela Área/Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descEnv">Descrição / Observação do Depoimento</Label>
              <Textarea
                id="descEnv"
                placeholder="Detalhes das lesões (se vítima), relato do depoimento (se testemunha)..."
                rows={2}
                value={descEnvolvimento}
                onChange={(e) => setDescEnvolvimento(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddEnvolvidoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectedColabId}>
                Vincular Envolvido
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
