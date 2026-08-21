import { useState } from "react";
import { SgsstBreadcrumb } from "@/components/sgsst/SgsstBreadcrumb";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstNaoConformidades,
  useSgsstNaoConformidadesDetail,
  useSgsstNaoConformidadeAcoes,
  useSgsstNaoConformidadeHistorico,
  StatusNC,
  SgsstNaoConformidadeAcao,
  ResultadoVerificacao,
} from "@/hooks/sgsst/useSgsstNaoConformidades";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresaAtual } from "@/hooks/useEmpresaAtual";
import { useAuth } from "@/contexts/AuthContext";
import { gerarPdfNc, pendenciasNc } from "@/lib/ncDocumento";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Search,
  CheckSquare,
  FileCheck,
  FileText,
  ShieldCheck,
  SearchCheck,
  Siren,
  History,
  Clock,
  FileDown,
  Loader2,
} from "lucide-react";
import { acoesPendentes, mensagemBloqueioEncerramento } from "@/utils/sgsstWorkflow";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { NcFormDialog } from "@/components/sgsst/NcFormDialog";
import { NcAcaoFormDialog } from "@/components/sgsst/NcAcaoFormDialog";
import { NcStatusDialog } from "@/components/sgsst/NcStatusDialog";
import { NcVerificacaoDialog } from "@/components/sgsst/NcVerificacaoDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstNaoConformidadesDetailPage() {
  const { ncId } = useParams<{ ncId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-nao-conformidades");

  const { updateNaoConformidade, updateStatusNaoConformidade, verificarNaoConformidade } = useSgsstNaoConformidades();
  const { data: currentNc, isLoading: loadingDetail } = useSgsstNaoConformidadesDetail(ncId);
  const { empresa } = useEmpresaAtual();
  const { profile } = useAuth();
  const [emitindo, setEmitindo] = useState(false);

  const { acoes, addAcao, updateAcao, removeAcao, isLoading: loadingAcoes } = useSgsstNaoConformidadeAcoes(ncId);
  const { historico } = useSgsstNaoConformidadeHistorico(ncId);

  // Dialog States
  const [isEditNcOpen, setIsEditNcOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isVerificacaoDialogOpen, setIsVerificacaoDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusNC>("EM_ANALISE");

  // Acao Form Dialog State
  const [isAcaoFormOpen, setIsAcaoFormOpen] = useState(false);
  const [editingAcao, setEditingAcao] = useState<SgsstNaoConformidadeAcao | null>(null);

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentNc) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Não Conformidade não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/nao-conformidades")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentNc.status === "CONCLUIDA" || currentNc.status === "CANCELADA";

  const emitirPdf = async () => {
    const dadosDoDocumento = {
      nc: currentNc,
      acoes,
      empresa: empresa ?? null,
      geradoPor: profile?.nome ?? null,
    };

    const pendencias = pendenciasNc(dadosDoDocumento);
    if (pendencias.length > 0) {
      toast.warning(`NC com ${pendencias.length} pendência(s)`, {
        description: pendencias.slice(0, 3).join(" · "),
      });
    }

    setEmitindo(true);
    try {
      await gerarPdfNc(dadosDoDocumento);
    } catch (e) {
      toast.error(`Erro ao emitir o relatório: ${(e as Error).message}`);
    } finally {
      setEmitindo(false);
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

  const openStatusModal = (status: StatusNC) => {
    if (status === "AGUARDANDO_VERIFICACAO") {
      const pendentes = acoesPendentes(acoes);
      if (pendentes.length > 0) {
        toast.error(mensagemBloqueioEncerramento(pendentes.length, "solicitar verificação"));
        return;
      }
    }
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusNaoConformidade.mutateAsync({
      id: currentNc.id,
      statusAnterior: currentNc.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  const handleConfirmVerificacao = async (data: { resultado: ResultadoVerificacao; observacao: string }) => {
    await verificarNaoConformidade.mutateAsync({
      id: currentNc.id,
      resultado: data.resultado,
      observacao: data.observacao,
    });
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
      <SgsstBreadcrumb moduloLabel="Não Conformidades" moduloPath="/medicoes/sgsst/nao-conformidades" itemTitle={currentNc.titulo || currentNc.codigo} />

      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/nao-conformidades")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar às Não Conformidades
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes da NC</span>
      </div>

      {/* Header Info Card */}
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentNc.codigo || "NC"}
                </span>
                <Badge variant="outline" className="text-xs font-mono bg-muted">
                  Origem: {currentNc.origem_tipo}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-amber-50 text-amber-800 border-amber-300">
                  Criticidade: {currentNc.criticidade}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-muted">
                  Status: {currentNc.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentNc.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Obra: <strong>{currentNc.projeto ? `[${currentNc.projeto.codigo}] ${currentNc.projeto.nome}` : "—"}</strong> | Canteiro: <strong>{currentNc.site ? currentNc.site.nome : "Geral"}</strong> | Setor: <strong>{currentNc.area ? currentNc.area.nome : "Geral"}</strong>
              </p>
            </div>

            {/* Emitir fica fora do allowEdit: emitir e leitura. */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={emitirPdf}
                disabled={emitindo}
                title="Emitir o relatório desta não conformidade em PDF"
              >
                {emitindo ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                )}
                Emitir relatório
              </Button>
            </div>

            {/* Workflow Action Buttons */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditNcOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Dados
                  </Button>
                )}

                {currentNc.status === "ABERTA" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openStatusModal("EM_ANALISE")}>
                    <Search className="h-3.5 w-3.5 mr-1" /> Submeter p/ Análise
                  </Button>
                )}

                {currentNc.status === "EM_ANALISE" && (
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => openStatusModal("PLANO_ACAO")}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Elaborar Plano de Ação
                  </Button>
                )}

                {currentNc.status === "PLANO_ACAO" && (
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => openStatusModal("EM_TRATAMENTO")}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Iniciar Tratamento
                  </Button>
                )}

                {currentNc.status === "EM_TRATAMENTO" && (
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => openStatusModal("AGUARDANDO_VERIFICACAO")}>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Solicitar Verificação
                  </Button>
                )}

                {currentNc.status === "AGUARDANDO_VERIFICACAO" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsVerificacaoDialogOpen(true)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Realizar Verificação & Concluir
                  </Button>
                )}

                {!isReadOnly && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => openStatusModal("CANCELADA")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar NC
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Data de Identificação:</span>
              <span className="font-semibold">{formatDateStr(currentNc.data_identificacao)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Prazo Limite de Adequação:</span>
              <span className="font-semibold">{formatDateStr(currentNc.prazo)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Responsável pelo Tratamento:</span>
              <span className="font-semibold">{currentNc.responsavel?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Auditor / Verificador de Eficácia:</span>
              <span className="font-semibold">{currentNc.verificador?.nome || "Pendente"} {currentNc.resultado_verificacao ? `(${currentNc.resultado_verificacao})` : ""}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="acoes" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="acoes" className="gap-2">
            <CheckSquare className="h-4 w-4" /> Planos de Ação ({acoes.length})
          </TabsTrigger>
          <TabsTrigger value="causa" className="gap-2">
            <Search className="h-4 w-4" /> Análise de Causa
          </TabsTrigger>
          <TabsTrigger value="origem" className="gap-2">
            <FileCheck className="h-4 w-4" /> Origem Mapeada
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PLANOS DE AÇÃO */}
        <TabsContent value="acoes" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Planos de Ação Corretiva e Preventiva (CAPA)</h3>
              <p className="text-xs text-muted-foreground">
                Ações obrigatórias para adequação da não conformidade apontada.
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
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando planos de ação...</TableCell></TableRow>
                  ) : acoes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma ação cadastrada para esta Não Conformidade.</TableCell></TableRow>
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
                                consequencia={"A ação sai do tratamento da não conformidade. Sem ações concluídas não é possível verificar a eficácia nem encerrar a NC."}
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

        {/* TAB 2: ANÁLISE DE CAUSA */}
        <TabsContent value="causa" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Análise Inicial de Causa Raiz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <Label>Causa Identificada:</Label>
                <div className="p-3 rounded bg-muted/40 text-xs border min-h-[80px]">
                  {currentNc.causa || "Nenhuma análise de causa cadastrada para este desvio."}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Observações de Campo / Recomendações:</Label>
                <div className="p-3 rounded bg-muted/40 text-xs border min-h-[60px]">
                  {currentNc.observacoes || "Sem observações adicionais."}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ORIGEM */}
        <TabsContent value="origem" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" /> Origem Mapeada no SGSST
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tipo de Origem:</span>
                <Badge variant="outline" className="font-mono font-bold text-xs">{currentNc.origem_tipo}</Badge>
              </div>

              {currentNc.origem_tipo === "INSPECAO" && currentNc.origem_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/inspecoes/${currentNc.origem_id}`)}>
                  <SearchCheck className="h-4 w-4 mr-1 text-primary" /> Ver Inspeção de Origem →
                </Button>
              )}

              {currentNc.origem_tipo === "INCIDENTE" && currentNc.origem_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/incidentes/${currentNc.origem_id}`)}>
                  <Siren className="h-4 w-4 mr-1 text-red-500" /> Ver Incidente/Acidente de Origem →
                </Button>
              )}

              {currentNc.origem_tipo === "PGR" && currentNc.origem_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/pgr/${currentNc.origem_id}`)}>
                  <FileCheck className="h-4 w-4 mr-1 text-primary" /> Ver PGR de Origem →
                </Button>
              )}

              {currentNc.origem_tipo === "APR" && currentNc.origem_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/apr/${currentNc.origem_id}`)}>
                  <FileText className="h-4 w-4 mr-1 text-primary" /> Ver APR de Origem →
                </Button>
              )}

              {currentNc.origem_tipo === "PT" && currentNc.origem_id && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/medicoes/sgsst/pt/${currentNc.origem_id}`)}>
                  <ShieldCheck className="h-4 w-4 mr-1 text-primary" /> Ver PT de Origem →
                </Button>
              )}

              {currentNc.origem_tipo === "MANUAL" && (
                <p className="text-muted-foreground">Esta Não Conformidade foi registrada manualmente de forma direta no sistema.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: HISTÓRICO */}
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
                    <TableHead>Parecer / Observação de Verificação</TableHead>
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
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Abertura"}</Badge></TableCell>
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
      <NcFormDialog
        open={isEditNcOpen}
        onOpenChange={setIsEditNcOpen}
        nc={currentNc}
        onSave={async (data) => {
          await updateNaoConformidade.mutateAsync({ id: currentNc.id, ...data });
        }}
      />

      <NcStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentNc.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusNaoConformidade.isPending}
      />

      <NcVerificacaoDialog
        open={isVerificacaoDialogOpen}
        onOpenChange={setIsVerificacaoDialogOpen}
        onConfirm={handleConfirmVerificacao}
        isLoading={verificarNaoConformidade.isPending}
      />

      <NcAcaoFormDialog
        open={isAcaoFormOpen}
        onOpenChange={setIsAcaoFormOpen}
        ncId={currentNc.id}
        acao={editingAcao}
        onSave={handleSaveAcao}
        isLoading={addAcao.isPending || updateAcao.isPending}
      />
    </div>
  );
}
