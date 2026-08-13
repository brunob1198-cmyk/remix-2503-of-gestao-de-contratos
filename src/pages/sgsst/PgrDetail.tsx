import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSgsstPgr, useSgsstPgrInventario, useSgsstPgrMedidasControle, SgsstPgrInventario, SgsstPgrMedidaControle, StatusPgr } from "@/hooks/sgsst/useSgsstPgr";
import { useSgsstRiscos } from "@/hooks/sgsst/useSgsstRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Edit2, Trash2, ShieldAlert, Wrench, AlertTriangle, CheckCircle2, Lock, FileCheck, Calendar, User, RefreshCw } from "lucide-react";
import { PgrInventarioFormDialog } from "@/components/sgsst/PgrInventarioFormDialog";
import { PgrMedidasFormDialog } from "@/components/sgsst/PgrMedidasFormDialog";
import { PgrFormDialog } from "@/components/sgsst/PgrFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";

export default function SgsstPgrDetailPage() {
  const { pgrId } = useParams<{ pgrId: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pgr");

  const { pgrs, updatePgr, updateStatusPgr } = useSgsstPgr();
  const currentPgr = pgrs.find((p) => p.id === pgrId);

  const { riscos: riscosCatalogo } = useSgsstRiscos();
  const { inventario, isLoading: loadingInventario, createInventarioItem, updateInventarioItem, removeInventarioItem } = useSgsstPgrInventario(pgrId);

  const [selectedInventarioId, setSelectedInventarioId] = useState<string | null>(null);
  const { medidas, isLoading: loadingMedidas, createMedida, updateMedida, removeMedida } = useSgsstPgrMedidasControle(selectedInventarioId || undefined);

  // Dialog States
  const [isEditPgrOpen, setIsEditPgrOpen] = useState(false);
  const [isInventarioFormOpen, setIsInventarioFormOpen] = useState(false);
  const [editingInventarioItem, setEditingInventarioItem] = useState<SgsstPgrInventario | null>(null);

  const [isMedidaFormOpen, setIsMedidaFormOpen] = useState(false);
  const [editingMedida, setEditingMedida] = useState<SgsstPgrMedidaControle | null>(null);

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

  const handleSaveInventario = async (data: any) => {
    if (editingInventarioItem) {
      await updateInventarioItem.mutateAsync({ id: editingInventarioItem.id, ...data });
    } else {
      await createInventarioItem.mutateAsync(data);
    }
  };

  // Medidas actions
  const handleOpenMedidas = (item: SgsstPgrInventario) => {
    setSelectedInventarioId(item.id);
  };

  const handleCreateMedida = () => {
    setEditingMedida(null);
    setIsMedidaFormOpen(true);
  };

  const handleEditMedida = (medida: SgsstPgrMedidaControle) => {
    setEditingMedida(medida);
    setIsMedidaFormOpen(true);
  };

  const handleSaveMedida = async (data: any) => {
    if (editingMedida) {
      await updateMedida.mutateAsync({ id: editingMedida.id, ...data });
    } else {
      await createMedida.mutateAsync(data);
    }
  };

  return (
    <div className="space-y-6">
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
              <span className="text-muted-foreground block">Próxima Revisão:</span>
              <span className="font-semibold">{formatDateStr(currentPgr.data_revisao)}</span>
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="inventario" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="inventario" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Inventário de Riscos ({inventario.length})
          </TabsTrigger>
          <TabsTrigger value="medidas" className="gap-2" disabled={!selectedInventarioId && inventario.length === 0}>
            <Wrench className="h-4 w-4" /> Medidas de Controle
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
                    <TableHead>Expostos</TableHead>
                    <TableHead>P × S</TableHead>
                    <TableHead>Matriz de Risco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInventario ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Carregando inventário de riscos...
                      </TableCell>
                    </TableRow>
                  ) : inventario.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                            <span className="font-medium text-xs">{item.perigo}</span>
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
                        <TableCell className="text-center font-mono">{item.trabalhadores_expostos}</TableCell>
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedInventarioId ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Clique em "Medidas" no risco desejado na aba de Inventário para ver seu plano de ação.
                      </TableCell>
                    </TableRow>
                  ) : loadingMedidas ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando medidas de controle...
                      </TableCell>
                    </TableRow>
                  ) : medidas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
      </Tabs>

      {/* Dialogs */}
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
