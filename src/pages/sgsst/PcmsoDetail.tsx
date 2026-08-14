import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstPcmso,
  useSgsstPcmsoDetail,
  useSgsstPcmsoExames,
  useSgsstPcmsoHistorico,
  StatusPcmso,
  TipoExamePcmso,
  SgsstPcmsoExame,
} from "@/hooks/sgsst/useSgsstPcmso";
import { useSgsstFuncoes } from "@/hooks/sgsst/useSgsstFuncoes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Lock,
  RefreshCw,
  Stethoscope,
  FileText,
  History,
} from "lucide-react";
import { PcmsoFormDialog } from "@/components/sgsst/PcmsoFormDialog";
import { PcmsoStatusDialog } from "@/components/sgsst/PcmsoStatusDialog";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstPcmsoDetailPage() {
  const { pcmsoId } = useParams<{ pcmsoId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pcmso");

  const { updatePcmso, updateStatusPcmso } = useSgsstPcmso();
  const { data: currentPcmso, isLoading: loadingDetail } = useSgsstPcmsoDetail(pcmsoId);

  const { funcoes } = useSgsstFuncoes();
  const { exames, isLoading: loadingExames, addExame, removeExame } = useSgsstPcmsoExames(pcmsoId);
  const { historico } = useSgsstPcmsoHistorico(pcmsoId);

  // Dialog States
  const [isEditPcmsoOpen, setIsEditPcmsoOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusPcmso>("ATIVO");

  // Exame Dialog State
  const [isAddExameOpen, setIsAddExameOpen] = useState(false);
  const [nomeExame, setNomeExame] = useState("");
  const [tipoExame, setTipoExame] = useState<TipoExamePcmso>("Periódico");
  const [periodicidadeMeses, setPeriodicidadeMeses] = useState(12);
  const [funcaoId, setFuncaoId] = useState("none");
  const [grupoRisco, setGrupoRisco] = useState("");
  const [obsExame, setObsExame] = useState("");

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentPcmso) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">PCMSO não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/pcmso")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentPcmso.status === "ENCERRADO" || currentPcmso.status === "CANCELADO";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const openStatusModal = (status: StatusPcmso) => {
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusPcmso.mutateAsync({
      id: currentPcmso.id,
      statusAnterior: currentPcmso.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  const handleAddExameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeExame.trim()) return;

    await addExame.mutateAsync({
      pcmso_id: currentPcmso.id,
      nome_exame: nomeExame.trim(),
      tipo_exame: tipoExame,
      periodicidade_meses: Number(periodicidadeMeses) || 12,
      funcao_id: funcaoId === "none" ? null : funcaoId,
      grupo_risco: grupoRisco.trim() || null,
      observacoes: obsExame.trim() || null,
    });

    setIsAddExameOpen(false);
    setNomeExame("");
    setGrupoRisco("");
    setObsExame("");
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/pcmso")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos Programas PCMSO
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes do PCMSO</span>
      </div>

      {/* Header Info Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentPcmso.codigo || "PCMSO"}
                </span>
                <Badge variant="outline" className="text-xs font-bold bg-muted">
                  Status: {currentPcmso.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentPcmso.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Escopo: <strong>{currentPcmso.projeto ? `[${currentPcmso.projeto.codigo}] ${currentPcmso.projeto.nome}` : "Geral da Empresa"}</strong> | Médico Responsável: <strong>{currentPcmso.medico_responsavel || "Não informado"}</strong> ({currentPcmso.crm_medico || "Sem CRM"})
              </p>
            </div>

            {/* Workflow Action Buttons */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditPcmsoOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Dados
                  </Button>
                )}

                {(currentPcmso.status === "RASCUNHO" || currentPcmso.status === "EM_REVISAO") && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openStatusModal("ATIVO")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ativar PCMSO (Vigente)
                  </Button>
                )}

                {currentPcmso.status === "ATIVO" && (
                  <>
                    <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => openStatusModal("EM_REVISAO")}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Submeter p/ Revisão Anual
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openStatusModal("ENCERRADO")}>
                      <Lock className="h-3.5 w-3.5 mr-1" /> Encerrar Programa
                    </Button>
                  </>
                )}

                {!isReadOnly && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => openStatusModal("CANCELADO")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Início da Vigência:</span>
              <span className="font-semibold">{formatDateStr(currentPcmso.data_inicio)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Previsão para Revisão Anual:</span>
              <span className="font-semibold">{formatDateStr(currentPcmso.data_revisao)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Gestor / Coordenador:</span>
              <span className="font-semibold">{currentPcmso.responsavel || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Exames Ocupacionais Previstos:</span>
              <span className="font-semibold text-primary">{exames.length} exames configurados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="exames" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="exames" className="gap-2">
            <Stethoscope className="h-4 w-4" /> Exames Ocupacionais Previstos ({exames.length})
          </TabsTrigger>
          <TabsTrigger value="objetivo" className="gap-2">
            <FileText className="h-4 w-4" /> Objetivo & Diretrizes
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXAMES PREVISTOS */}
        <TabsContent value="exames" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Quadro de Exames Ocupacionais Previstos (NR-7)</h3>
              <p className="text-xs text-muted-foreground">
                Configuração dos exames médicos e laboratoriais por função, grupo de risco e periodicidade.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddExameOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Configurar Exame Previsto
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Exame / Procedimento</TableHead>
                    <TableHead>Tipo de Exame</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Função Aplicável</TableHead>
                    <TableHead>Grupo de Risco</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExames ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando exames previstos...</TableCell></TableRow>
                  ) : exames.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum exame previsto configurado neste PCMSO.</TableCell></TableRow>
                  ) : (
                    exames.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">{ex.nome_exame}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{ex.tipo_exame}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{ex.periodicidade_meses} mês(es)</TableCell>
                        <TableCell className="text-xs">{ex.funcao?.nome || "Todas as Funções"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ex.grupo_risco || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ex.observacoes || "—"}</TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isReadOnly && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeExame.mutate(ex.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        {/* TAB 2: OBJETIVO E DIRETRIZES */}
        <TabsContent value="objetivo" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" /> Diretrizes e Objetivo Geral do Programa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <Label className="font-semibold">Objetivo do PCMSO:</Label>
                <div className="p-3 rounded bg-muted/40 text-xs border min-h-[80px]">
                  {currentPcmso.objetivo || "Não informado."}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Observações Gerais / Orientações para ASO:</Label>
                <div className="p-3 rounded bg-muted/40 text-xs border min-h-[60px]">
                  {currentPcmso.observacoes || "Sem observações registradas."}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HISTÓRICO DE REVISÕES */}
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
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Elaboração"}</Badge></TableCell>
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
      <PcmsoFormDialog
        open={isEditPcmsoOpen}
        onOpenChange={setIsEditPcmsoOpen}
        pcmso={currentPcmso}
        onSave={async (data) => {
          await updatePcmso.mutateAsync({ id: currentPcmso.id, ...data });
        }}
      />

      <PcmsoStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentPcmso.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusPcmso.isPending}
      />

      {/* Modal Configurar Exame Previsto */}
      <Dialog open={isAddExameOpen} onOpenChange={setIsAddExameOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurar Exame Ocupacional Previsto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExameSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="nomeEx">Nome do Exame / Procedimento *</Label>
              <Input
                id="nomeEx"
                placeholder="Ex: Hemograma Completo, Audiometria, Acuidade Visual, ECG, EEG"
                value={nomeExame}
                onChange={(e) => setNomeExame(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tipoEx">Tipo de Exame *</Label>
                <Select value={tipoExame} onValueChange={(val: TipoExamePcmso) => setTipoExame(val)}>
                  <SelectTrigger id="tipoEx">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admissional">Admissional</SelectItem>
                    <SelectItem value="Periódico">Periódico</SelectItem>
                    <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                    <SelectItem value="Mudança de Risco/Função">Mudança de Risco/Função</SelectItem>
                    <SelectItem value="Demissional">Demissional</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="perio">Periodicidade (Meses) *</Label>
                <Input
                  id="perio"
                  type="number"
                  min={1}
                  max={60}
                  value={periodicidadeMeses}
                  onChange={(e) => setPeriodicidadeMeses(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="funcaoEx">Função Específica</Label>
                <Select value={funcaoId} onValueChange={setFuncaoId}>
                  <SelectTrigger id="funcaoEx">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Todas as Funções --</SelectItem>
                    {funcoes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="grupo">Grupo de Risco</Label>
                <Input
                  id="grupo"
                  placeholder="Ex: Ruído elevado, Trabalho em altura..."
                  value={grupoRisco}
                  onChange={(e) => setGrupoRisco(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obsEx">Observações / Recomendações</Label>
              <Textarea
                id="obsEx"
                placeholder="Jejum recomendado, preparo específico..."
                rows={2}
                value={obsExame}
                onChange={(e) => setObsExame(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddExameOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!nomeExame.trim()}>
                Configurar Exame
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
