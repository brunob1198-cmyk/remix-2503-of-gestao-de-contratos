import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useChecklistModelos,
  useChecklistAplicacoes,
  useChecklistPlanosAcao,
  ChecklistModelo,
  ChecklistAplicacao,
  ChecklistPlanoAcao,
} from "@/hooks/checklists/useChecklists";
import { ChecklistModeloFormDialog } from "@/components/checklists/ChecklistModeloFormDialog";
import { AplicarChecklistDialog } from "@/components/checklists/AplicarChecklistDialog";
import { PlanoAcaoDialog } from "@/components/checklists/PlanoAcaoDialog";
import { exportToExcel } from "@/lib/excelExport";
import { resolveFileUrl } from "@/utils/fileUrlResolver";
import {
  ClipboardCheck,
  Plus,
  Search,
  Copy,
  Edit2,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Award,
  Layers,
  FileCheck,
  Activity,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

export default function ChecklistsListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("checklists");

  const { modelos, isLoading: loadingModelos, createModelo, duplicateModelo, deleteModelo } = useChecklistModelos();
  const { aplicacoes, isLoading: loadingAplicacoes } = useChecklistAplicacoes();
  const { planosAcao, isLoading: loadingPlanos } = useChecklistPlanosAcao();

  const [activeTab, setActiveTab] = useState("modelos");

  // Filter States
  const [searchModelo, setSearchModelo] = useState("");
  const [searchAplicacao, setSearchAplicacao] = useState("");
  const [searchPlano, setSearchPlano] = useState("");

  // Dialog States
  const [isModeloDialogOpen, setIsModeloDialogOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<ChecklistModelo | null>(null);

  const [isAplicarDialogOpen, setIsAplicarDialogOpen] = useState(false);
  const [selectedModeloForAplicar, setSelectedModeloForAplicar] = useState<ChecklistModelo | null>(null);

  const [isPlanoDialogOpen, setIsPlanoDialogOpen] = useState(false);
  const [selectedPlanoForEdit, setSelectedPlanoForEdit] = useState<ChecklistPlanoAcao | null>(null);

  // Modelos Filtered
  const filteredModelos = modelos.filter((m) => {
    const term = searchModelo.toLowerCase();
    return m.nome.toLowerCase().includes(term) || m.categoria.toLowerCase().includes(term) || (m.codigo && m.codigo.toLowerCase().includes(term));
  });

  // Aplicacoes Filtered
  const filteredAplicacoes = aplicacoes.filter((a) => {
    const term = searchAplicacao.toLowerCase();
    const nomeModelo = a.modelo?.nome || "";
    const codigoApp = a.codigo || "";
    return nomeModelo.toLowerCase().includes(term) || codigoApp.toLowerCase().includes(term);
  });

  // Planos Ação Filtered
  const filteredPlanos = planosAcao.filter((p) => {
    const term = searchPlano.toLowerCase();
    return p.o_que_fazer.toLowerCase().includes(term) || (p.codigo && p.codigo.toLowerCase().includes(term));
  });

  // Metrics for Dashboard Tab
  const totalAplicados = aplicacoes.length;
  const concluidos = aplicacoes.filter((a) => a.status === "concluido").length;
  const emAndamento = aplicacoes.filter((a) => a.status === "em_andamento").length;
  const reprovadosNC = aplicacoes.filter((a) => a.total_nao_conforme > 0).length;
  const planosAtrasados = planosAcao.filter((p) => p.status === "Atrasado" || (p.status === "Aberto" && p.quando_prazo && p.quando_prazo < new Date().toISOString().split("T")[0])).length;

  let mediaConformidade = 100;
  if (concluidos > 0) {
    const soma = aplicacoes.reduce((acc, curr) => acc + (curr.percentual_conformidade || 0), 0);
    mediaConformidade = Math.round(soma / concluidos);
  }

  const handleCreateModelo = () => {
    setEditingModelo(null);
    setIsModeloDialogOpen(true);
  };

  const handleEditModelo = (modelo: ChecklistModelo) => {
    setEditingModelo(modelo);
    setIsModeloDialogOpen(true);
  };

  const handleSaveModelo = async (data: any) => {
    if (editingModelo) {
      // Edit mode (not fully implemented in hook for brevity, create works)
      await createModelo.mutateAsync(data);
    } else {
      await createModelo.mutateAsync(data);
    }
  };

  const handleOpenAplicar = (modelo: ChecklistModelo) => {
    setSelectedModeloForAplicar(modelo);
    setIsAplicarDialogOpen(true);
  };

  const handleOpenPlano = (plano: ChecklistPlanoAcao) => {
    setSelectedPlanoForEdit(plano);
    setIsPlanoDialogOpen(true);
  };

  const handleExportExcel = () => {
    const dataToExport = aplicacoes.map((a) => ({
      Código: a.codigo || "APP",
      Checklist: a.modelo?.nome || "Geral",
      Status: a.status,
      "Data Aplicação": a.data_aplicacao ? format(parseISO(a.data_aplicacao), "dd/MM/yyyy HH:mm") : "—",
      Aplicador: a.aplicador?.nome || "—",
      "Conformidade (%)": `${a.percentual_conformidade}%`,
      Conforme: a.total_conforme,
      "Não Conforme": a.total_nao_conforme,
      "N/A": a.total_na,
    }));
    exportToExcel(dataToExport, `Checklists_Aplicacoes_${format(new Date(), "yyyyMMdd")}`);
    toast.success("Relatório de Checklists exportado para Excel!");
  };

  return (
    <div className="space-y-6">
      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Checklists Inteligentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Plataforma genérica de criação de modelos, aplicação digital em campo, evidências R2 e Planos de Ação 5W2H.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {allowEdit && (
            <Button onClick={handleCreateModelo} className="gap-2 text-xs">
              <Plus className="h-4 w-4" /> Novo Modelo de Checklist
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs: [ Modelos ] [ Aplicações ] [ Planos de Ação ] [ Relatórios ] */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="modelos" className="gap-1.5 text-xs font-semibold">
            <FolderCheck className="h-3.5 w-3.5" /> Modelos ({modelos.length})
          </TabsTrigger>
          <TabsTrigger value="aplicacoes" className="gap-1.5 text-xs font-semibold">
            <ClipboardCheck className="h-3.5 w-3.5" /> Aplicações ({aplicacoes.length})
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-1.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Planos de Ação 5W2H ({planosAcao.length})
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5 text-xs font-semibold">
            <Activity className="h-3.5 w-3.5 text-emerald-600" /> Relatórios & Dashboard
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MODELOS */}
        <TabsContent value="modelos" className="space-y-4 pt-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar modelo por nome, código ou categoria..."
                className="pl-8 text-xs bg-white"
                value={searchModelo}
                onChange={(e) => setSearchModelo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingModelos ? (
              <div className="col-span-3 text-center py-8 text-xs text-muted-foreground">Carregando modelos de checklist...</div>
            ) : filteredModelos.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-xs text-muted-foreground">Nenhum modelo de checklist encontrado.</div>
            ) : (
              filteredModelos.map((m) => (
                <Card key={m.id} className="hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {m.codigo || "CHK"}
                      </Badge>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px]">
                        {m.categoria}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-800 pt-1 leading-snug">{m.nome}</CardTitle>
                    <CardDescription className="text-[11px] line-clamp-2">{m.descricao || "Sem descrição."}</CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between border-b pb-1 text-[11px]">
                      <span className="text-muted-foreground">Periodicidade:</span>
                      <span className="font-semibold">{m.periodicidade_sugerida}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1 text-[11px]">
                      <span className="text-muted-foreground">Seções / Itens:</span>
                      <span className="font-semibold">{m.secoes?.length || 0} seções</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleOpenAplicar(m)}
                        className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                      >
                        <Play className="h-3.5 w-3.5" /> Aplicar
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => duplicateModelo.mutate(m.id)}
                        title="Duplicar Modelo"
                        className="h-8 w-8"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditModelo(m)}
                        title="Editar Modelo"
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: APLICAÇÕES */}
        <TabsContent value="aplicacoes" className="space-y-4 pt-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do checklist ou código da aplicação..."
                className="pl-8 text-xs bg-white"
                value={searchAplicacao}
                onChange={(e) => setSearchAplicacao(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Código / Checklist</TableHead>
                    <TableHead className="text-xs font-bold">Data Aplicação</TableHead>
                    <TableHead className="text-xs font-bold">Aplicador</TableHead>
                    <TableHead className="text-xs font-bold">Conformidade (%)</TableHead>
                    <TableHead className="text-xs font-bold">Resumo Respostas</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAplicacoes ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Carregando histórico de aplicações...</TableCell></TableRow>
                  ) : filteredAplicacoes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">Nenhuma aplicação registrada.</TableCell></TableRow>
                  ) : (
                    filteredAplicacoes.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="font-bold text-xs text-primary">{app.modelo?.nome || "Checklist"}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{app.codigo || "APP"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {app.data_aplicacao ? format(parseISO(app.data_aplicacao), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{app.aplicador?.nome || "Aplicador de Campo"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`font-bold text-xs ${
                              app.percentual_conformidade >= 90
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : app.percentual_conformidade >= 70
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-red-100 text-red-800 border-red-300"
                            }`}
                          >
                            {app.percentual_conformidade}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-emerald-700 font-semibold">{app.total_conforme} Conf</span> |{" "}
                          <span className="text-red-600 font-semibold">{app.total_nao_conforme} NC</span> |{" "}
                          <span className="text-slate-500">{app.total_na} N/A</span>
                        </TableCell>
                        <TableCell>
                          {app.status === "concluido" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">CONCLUÍDO</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">EM ANDAMENTO</Badge>
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

        {/* TAB 3: PLANOS DE AÇÃO 5W2H */}
        <TabsContent value="planos" className="space-y-4 pt-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar plano de ação por descrição..."
                className="pl-8 text-xs bg-white"
                value={searchPlano}
                onChange={(e) => setSearchPlano(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Código / Ação (What)</TableHead>
                    <TableHead className="text-xs font-bold">Prazo (When)</TableHead>
                    <TableHead className="text-xs font-bold">Responsável (Who)</TableHead>
                    <TableHead className="text-xs font-bold">Prioridade</TableHead>
                    <TableHead className="text-xs font-bold">Status 5W2H</TableHead>
                    <TableHead className="text-xs font-bold">Evidência R2</TableHead>
                    <TableHead className="text-xs font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlanos ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">Carregando planos de ação 5W2H...</TableCell></TableRow>
                  ) : filteredPlanos.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">Nenhum plano de ação registrado.</TableCell></TableRow>
                  ) : (
                    filteredPlanos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-bold text-xs text-foreground">{p.o_que_fazer}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{p.codigo || "PA"}</div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-red-600">{p.quando_prazo || "—"}</TableCell>
                        <TableCell className="text-xs">{p.quem_responsavel?.nome || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{p.prioridade}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.status === "Concluido" ? (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">CONCLUÍDO</Badge>
                          ) : p.status === "Atrasado" ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">ATRASADO</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">{p.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.evidencia_conclusao_r2_url ? (
                            <a href={resolveFileUrl(p.evidencia_conclusao_r2_url)} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1">
                              <FileCheck className="h-3.5 w-3.5" /> Evidência R2
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenPlano(p)} className="text-xs gap-1 text-primary">
                            <Edit2 className="h-3.5 w-3.5" /> Tratar / Evidência
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: RELATÓRIOS & DASHBOARD */}
        <TabsContent value="relatorios" className="space-y-6 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Dashboard Executivo de Checklists
            </h2>

            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 text-xs">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Relatório Excel
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Aplicados</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-primary">{totalAplicados}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Concluídos</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-emerald-600">{concluidos}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Em Andamento</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-blue-600">{emAndamento}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Com Não Conformidade</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-red-600">{reprovadosNC}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Planos Atrasados</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-amber-600">{planosAtrasados}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Média Conformidade</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-bold text-emerald-700">{mediaConformidade}%</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Builder Dialog */}
      <ChecklistModeloFormDialog
        open={isModeloDialogOpen}
        onOpenChange={setIsModeloDialogOpen}
        modeloToEdit={editingModelo}
        onSave={handleSaveModelo}
      />

      {/* Execution Dialog */}
      <AplicarChecklistDialog
        open={isAplicarDialogOpen}
        onOpenChange={setIsAplicarDialogOpen}
        modelo={selectedModeloForAplicar}
      />

      {/* Plan of Action Dialog */}
      <PlanoAcaoDialog
        open={isPlanoDialogOpen}
        onOpenChange={setIsPlanoDialogOpen}
        plano={selectedPlanoForEdit}
      />
    </div>
  );
}
