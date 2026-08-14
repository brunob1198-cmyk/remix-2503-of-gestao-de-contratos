import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useSgsstInspecoes,
  useSgsstInspecoesDetail,
  useSgsstInspecaoItens,
  useSgsstInspecaoNaoConformidades,
  useSgsstInspecaoHistorico,
  StatusInspecao,
  SgsstInspecaoItem,
  SgsstInspecaoNaoConformidade,
  CriticidadeNC,
  StatusNC,
} from "@/hooks/sgsst/useSgsstInspecoes";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  SearchCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlayCircle,
  Lock,
  ClipboardCheck,
  FileText,
  FileCheck,
  ShieldCheck,
  History,
  AlertTriangle,
} from "lucide-react";
import { InspecaoFormDialog } from "@/components/sgsst/InspecaoFormDialog";
import { InspecaoNaoConformidadeFormDialog } from "@/components/sgsst/InspecaoNaoConformidadeFormDialog";
import { InspecaoStatusDialog } from "@/components/sgsst/InspecaoStatusDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function SgsstInspecoesDetailPage() {
  const { inspecaoId } = useParams<{ inspecaoId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-inspecoes");

  const { updateInspecao, updateStatusInspecao } = useSgsstInspecoes();
  const { data: currentInspecao, isLoading: loadingDetail } = useSgsstInspecoesDetail(inspecaoId);

  const { riscos: riscosCatalogo } = useSgsstRiscos();
  const { itens, isLoading: loadingItens, updateRespostaItem, addItem, removeItem } = useSgsstInspecaoItens(inspecaoId);
  const { naoConformidades, isLoading: loadingNC, addNaoConformidade, updateNaoConformidade, removeNaoConformidade } = useSgsstInspecaoNaoConformidades(inspecaoId);
  const { historico } = useSgsstInspecaoHistorico(inspecaoId);

  // Dialog States
  const [isEditInspecaoOpen, setIsEditInspecaoOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusInspecao>("EM_EXECUCAO");

  // Checklist Item State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItemTexto, setNewItemTexto] = useState("");
  const [newItemCategoria, setNewItemCategoria] = useState("Geral");
  const [newItemObrigatorio, setNewItemObrigatorio] = useState(true);

  // NC Form Dialog State
  const [isNcFormOpen, setIsNcFormOpen] = useState(false);
  const [editingNcItem, setEditingNcItem] = useState<SgsstInspecaoNaoConformidade | null>(null);
  const [activeItemIdForNc, setActiveItemIdForNc] = useState<string | null>(null);

  if (loadingDetail) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentInspecao) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground">Inspeção de segurança não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/medicoes/sgsst/inspecoes")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  const isReadOnly = currentInspecao.status === "CONCLUIDA" || currentInspecao.status === "CANCELADA";

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const getCriticidadeBadge = (criticidade: CriticidadeNC) => {
    switch (criticidade) {
      case "BAIXA":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">BAIXA</Badge>;
      case "MEDIA":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">MÉDIA</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">ALTA</Badge>;
      case "CRITICA":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">CRÍTICA</Badge>;
      default:
        return <Badge variant="outline">{criticidade}</Badge>;
    }
  };

  const handleRespostaChecklist = async (item: SgsstInspecaoItem, resposta: any) => {
    await updateRespostaItem.mutateAsync({ id: item.id, resposta });

    // If item marked as NAO_CONFORME, prompt user to register Não Conformidade
    if (resposta === "NAO_CONFORME") {
      setActiveItemIdForNc(item.id);
      setEditingNcItem(null);
      setIsNcFormOpen(true);
      toast.info("Item marcado como Não Conforme. Registre os detalhes da Não Conformidade.");
    }
  };

  const openStatusModal = (status: StatusInspecao) => {
    if (status === "CONCLUIDA") {
      const pendentesObrigatorios = itens.filter((i) => i.obrigatorio && i.resposta === "PENDENTE");
      if (pendentesObrigatorios.length > 0) {
        toast.error(`Não é possível concluir a inspeção. Existem ${pendentesObrigatorios.length} item(ns) obrigatório(s) pendentes no checklist.`);
        return;
      }
    }
    setTargetStatus(status);
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async (observacao: string) => {
    await updateStatusInspecao.mutateAsync({
      id: currentInspecao.id,
      statusAnterior: currentInspecao.status,
      novoStatus: targetStatus,
      observacao,
    });
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTexto.trim()) return;

    await addItem.mutateAsync({
      ordem: itens.length + 1,
      descricao: newItemTexto.trim(),
      categoria: newItemCategoria.trim(),
      obrigatorio: newItemObrigatorio,
    });

    setIsAddItemOpen(false);
    setNewItemTexto("");
  };

  const handleSaveNc = async (data: any) => {
    if (editingNcItem) {
      await updateNaoConformidade.mutateAsync({ id: editingNcItem.id, ...data });
    } else {
      await addNaoConformidade.mutateAsync(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/medicoes/sgsst/inspecoes")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar às Inspeções
        </Button>
        <span className="text-xs text-muted-foreground">/ Detalhes da Inspeção</span>
      </div>

      {/* Summary Header Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {currentInspecao.codigo || "INSP"}
                </span>
                <Badge variant="outline" className="text-xs font-semibold">
                  Tipo: {currentInspecao.tipo}
                </Badge>
                <Badge variant="outline" className="text-xs font-bold bg-muted">
                  Status: {currentInspecao.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{currentInspecao.titulo}</h1>
              <p className="text-xs text-muted-foreground">
                Obra: <strong>{currentInspecao.projeto ? `[${currentInspecao.projeto.codigo}] ${currentInspecao.projeto.nome}` : "—"}</strong> | Canteiro: <strong>{currentInspecao.site ? currentInspecao.site.nome : "Geral da Obra"}</strong> | Setor: <strong>{currentInspecao.area ? currentInspecao.area.nome : "Geral"}</strong>
              </p>
            </div>

            {/* Workflow Action Buttons */}
            {allowEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditInspecaoOpen(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar Dados
                  </Button>
                )}

                {currentInspecao.status === "PLANEJADA" && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openStatusModal("EM_EXECUCAO")}>
                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Iniciar Execução
                  </Button>
                )}

                {currentInspecao.status === "EM_EXECUCAO" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openStatusModal("CONCLUIDA")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir Inspeção
                  </Button>
                )}

                {!isReadOnly && (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => openStatusModal("CANCELADA")}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar Inspeção
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t text-xs">
            <div>
              <span className="text-muted-foreground block">Data Planejada:</span>
              <span className="font-semibold">{currentInspecao.data_planejada}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Data de Execução:</span>
              <span className="font-semibold">{formatDateStr(currentInspecao.data_execucao)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Inspetor / TST Responsável:</span>
              <span className="font-semibold">{currentInspecao.responsavel?.nome || "Não definido"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Não Conformidades Apontadas:</span>
              <span className="font-semibold text-red-600">{naoConformidades.length} NCs registradas</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="checklist" className="gap-2">
            <ClipboardCheck className="h-4 w-4" /> Checklist ({itens.length})
          </TabsTrigger>
          <TabsTrigger value="nc" className="gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" /> Não Conformidades ({naoConformidades.length})
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2">
            <FileText className="h-4 w-4" /> Documentos Vinculados
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico ({historico.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CHECKLIST */}
        <TabsContent value="checklist" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Lista de Verificação de Segurança</h3>
              <p className="text-xs text-muted-foreground">
                Auditoria de campo dos itens obrigatórios e avaliação de conformidade.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button onClick={() => setIsAddItemOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar Item ao Checklist
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Item de Inspeção</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Resposta da Auditoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingItens ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando itens do checklist...</TableCell></TableRow>
                  ) : itens.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum item no checklist.</TableCell></TableRow>
                  ) : (
                    itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.ordem}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm max-w-sm">{item.descricao}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{item.categoria || "Geral"}</Badge></TableCell>
                        <TableCell>
                          {item.obrigatorio ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Sim</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={item.resposta === "CONFORME" ? "default" : "outline"}
                              className={item.resposta === "CONFORME" ? "bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" : "h-7 text-xs"}
                              onClick={() => handleRespostaChecklist(item, "CONFORME")}
                              disabled={isReadOnly || !allowEdit}
                            >
                              Conforme
                            </Button>
                            <Button
                              size="sm"
                              variant={item.resposta === "NAO_CONFORME" ? "destructive" : "outline"}
                              className={item.resposta === "NAO_CONFORME" ? "h-7 text-xs font-bold" : "h-7 text-xs"}
                              onClick={() => handleRespostaChecklist(item, "NAO_CONFORME")}
                              disabled={isReadOnly || !allowEdit}
                            >
                              Não Conforme
                            </Button>
                            <Button
                              size="sm"
                              variant={item.resposta === "NAO_APLICAVEL" ? "secondary" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => handleRespostaChecklist(item, "NAO_APLICAVEL")}
                              disabled={isReadOnly || !allowEdit}
                            >
                              N/A
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isReadOnly && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeItem.mutate(item.id)}
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

        {/* TAB 2: NÃO CONFORMIDADES */}
        <TabsContent value="nc" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Apontamentos e Não Conformidades Mapeadas
              </h3>
              <p className="text-xs text-muted-foreground">
                Planos de ação para adequação das irregularidades encontradas na inspeção.
              </p>
            </div>
            {allowEdit && !isReadOnly && (
              <Button
                onClick={() => {
                  setActiveItemIdForNc(null);
                  setEditingNcItem(null);
                  setIsNcFormOpen(true);
                }}
                size="sm"
                variant="destructive"
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Registrar Não Conformidade Direta
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição da Não Conformidade</TableHead>
                    <TableHead>Criticidade</TableHead>
                    <TableHead>Evidência / Observação</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingNC ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando Não Conformidades...</TableCell></TableRow>
                  ) : naoConformidades.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma Não Conformidade registrada nesta inspeção.</TableCell></TableRow>
                  ) : (
                    naoConformidades.map((nc) => (
                      <TableRow key={nc.id}>
                        <TableCell className="font-medium text-xs max-w-xs">{nc.descricao}</TableCell>
                        <TableCell>{getCriticidadeBadge(nc.criticidade)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{nc.evidencia || "—"}</TableCell>
                        <TableCell className="text-xs">{nc.responsavel?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(nc.prazo)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-semibold">{nc.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {allowEdit && !isReadOnly && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingNcItem(nc);
                                  setIsNcFormOpen(true);
                                }}
                                title="Editar NC"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeNaoConformidade.mutate(nc.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

        {/* TAB 3: DOCUMENTOS VINCULADOS */}
        <TabsContent value="documentos" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" /> PGR Referência
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentInspecao.pgr ? (
                  <div>
                    <span className="font-medium block">{currentInspecao.pgr.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/pgr/${currentInspecao.pgr_id}`)}>
                      Abrir PGR →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum PGR vinculado diretamente.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> APR Referência
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentInspecao.apr ? (
                  <div>
                    <span className="font-medium block">{currentInspecao.apr.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/apr/${currentInspecao.apr_id}`)}>
                      Abrir APR →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma APR vinculada diretamente.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> PT Referência
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {currentInspecao.pt ? (
                  <div>
                    <span className="font-medium block">{currentInspecao.pt.titulo}</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/medicoes/sgsst/pt/${currentInspecao.pt_id}`)}>
                      Abrir PT →
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma PT vinculada diretamente.</span>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: HISTÓRICO DE AUDITORIA */}
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
                        <TableCell className="text-xs"><Badge variant="outline">{h.status_anterior || "Planejamento"}</Badge></TableCell>
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
      <InspecaoFormDialog
        open={isEditInspecaoOpen}
        onOpenChange={setIsEditInspecaoOpen}
        inspecao={currentInspecao}
        onSave={async (data) => {
          await updateInspecao.mutateAsync({ id: currentInspecao.id, ...data });
        }}
      />

      <InspecaoStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        statusAnterior={currentInspecao.status}
        novoStatus={targetStatus}
        onConfirm={handleConfirmStatusChange}
        isLoading={updateStatusInspecao.isPending}
      />

      <InspecaoNaoConformidadeFormDialog
        open={isNcFormOpen}
        onOpenChange={setIsNcFormOpen}
        inspecaoId={currentInspecao.id}
        itemId={activeItemIdForNc}
        naoConformidade={editingNcItem}
        riscosCatalogo={riscosCatalogo}
        onSave={handleSaveNc}
        isLoading={addNaoConformidade.isPending || updateNaoConformidade.isPending}
      />

      {/* Modal Adicionar Item ao Checklist */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Checklist de Inspeção</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItemSubmit} className="space-y-4 py-2 text-xs sm:text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="itemTexto">Descrição do Item *</Label>
              <Input
                id="itemTexto"
                placeholder="Ex: Verificação do estado das redes de proteção de periferia"
                value={newItemTexto}
                onChange={(e) => setNewItemTexto(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat">Categoria</Label>
              <Input
                id="cat"
                placeholder="Ex: EPC, Proteção Coletiva, EPI..."
                value={newItemCategoria}
                onChange={(e) => setNewItemCategoria(e.target.value)}
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
                Item Obrigatório para Conclusão da Inspeção
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newItemTexto.trim()}>
                Adicionar Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
