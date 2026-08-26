import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useChecklistModelos,
  useChecklistAplicacoes,
  useChecklistPlanosAcao,
  useChecklistPlanosAcaoStats,
  useChecklistReincidencias,
  CHECKLIST_STATS_LIMITE_LINHAS,
  ChecklistModelo,
  ChecklistAplicacao,
  ChecklistPlanoAcao,
} from "@/hooks/checklists/useChecklists";
import { ChecklistModeloFormDialog } from "@/components/checklists/ChecklistModeloFormDialog";
import { AplicarChecklistDialog } from "@/components/checklists/AplicarChecklistDialog";
import { PlanoAcaoDialog } from "@/components/checklists/PlanoAcaoDialog";
import { ChecklistAgendamentosTab } from "@/components/checklists/ChecklistAgendamentosTab";
import { ChecklistQrCodeDialog } from "@/components/checklists/ChecklistQrCodeDialog";
import { ChecklistSyncCenterDialog } from "@/components/checklists/ChecklistSyncCenterDialog";
import { useChecklistsOffline } from "@/hooks/checklists/useChecklistsOffline";
import { useChecklistsAutoSync } from "@/hooks/checklists/useChecklistsAutoSync";
import { useChecklistsCacheAutomatico } from "@/hooks/checklists/useChecklistsCacheAutomatico";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
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
  FolderCheck,
  Calendar,
  QrCode,
  HardDrive,
  DownloadCloud,
  RefreshCcw,
  MapPin,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const STATUS_PLANO_COR: Record<string, string> = {
  Aberto: "#f59e0b",
  Em_Andamento: "#3b82f6",
  Concluido: "#10b981",
  Atrasado: "#ef4444",
  Cancelado: "#94a3b8",
};

const STATUS_PLANO_LABEL: Record<string, string> = {
  Aberto: "Aberto",
  Em_Andamento: "Em Andamento",
  Concluido: "Concluído",
  Atrasado: "Atrasado",
  Cancelado: "Cancelado",
};

/** Agrupa e ordena por contagem desc, mantendo só o top N + "Outros". */
function rankingTopN(itens: string[], topN = 6): { name: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    contagem.set(item, (contagem.get(item) || 0) + 1);
  }
  const ordenado = Array.from(contagem.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  if (ordenado.length <= topN) return ordenado;

  const top = ordenado.slice(0, topN);
  const outros = ordenado.slice(topN).reduce((acc, cur) => acc + cur.total, 0);
  return [...top, { name: "Outros", total: outros }];
}

export default function ChecklistsListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("checklists");

  const { modelos, isLoading: loadingModelos, isTableMissing, createModelo, duplicateModelo, deleteModelo } = useChecklistModelos();
  // As duas consultas não tinham limite: aplicação de checklist e plano de ação são
  // os registros que mais acumulam nesta tela, e a lista aparecia cortada em
  // silêncio quando passava do teto do PostgREST.
  const [pageApl, setPageApl] = useState(0);
  const [pageSizeApl, setPageSizeApl] = useState(25);
  const [pagePlano, setPagePlano] = useState(0);
  const [pageSizePlano, setPageSizePlano] = useState(25);

  const {
    aplicacoes,
    total: totalAplicacoes,
    isLoading: loadingAplicacoes,
    deleteAplicacao,
  } = useChecklistAplicacoes({ page: pageApl, pageSize: pageSizeApl });

  const {
    planosAcao,
    total: totalPlanos,
    isLoading: loadingPlanos,
  } = useChecklistPlanosAcao({ page: pagePlano, pageSize: pageSizePlano });

  // Estatísticas agregadas (não paginadas) para os gráficos da aba Relatórios e
  // para o relatório de Reincidências — ver o comentário no hook sobre por que
  // isso não pode reaproveitar a lista paginada acima.
  const { linhas: planosStats, truncado: planosStatsTruncado } = useChecklistPlanosAcaoStats();
  const [minOcorrenciasReincidencia, setMinOcorrenciasReincidencia] = useState(2);
  const {
    linhas: reincidencias,
    totalItensComOcorrencia,
    truncado: reincidenciasTruncado,
    isLoading: loadingReincidencias,
  } = useChecklistReincidencias({ minOcorrencias: minOcorrenciasReincidencia });

  const totalPagesApl = Math.ceil(totalAplicacoes / pageSizeApl) || 1;
  const totalPagesPlano = Math.ceil(totalPlanos / pageSizePlano) || 1;

  // Painel lateral de navegação do módulo: estado persiste entre visitas (como em
  // Cadastros) e aceita ?tab= vindo de outra tela (ex.: um link "ver planos de
  // ação atrasados" que já abre na aba certa).
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistedState<string>("checklists:activeTab", "modelos");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, activeTab, setActiveTab, setSearchParams]);

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

  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [selectedModeloForQr, setSelectedModeloForQr] = useState<ChecklistModelo | null>(null);

  const [isSyncCenterOpen, setIsSyncCenterOpen] = useState(false);

  // Connection & Offline Hooks (PROMPT 021)
  const { statusLabel } = useConnectionStatus();
  const { offlineModels, toggleModelOfflineAvailability } = useChecklistsOffline();

  // A fila offline passa a subir sozinha: ao voltar a conexao, na abertura da tela
  // e periodicamente enquanto houver pendencia. Antes nada disparava a
  // sincronizacao — o checklist ficava no celular ate alguem abrir o Centro de
  // Sincronizacao e clicar.
  useChecklistsAutoSync();

  // E os modelos ativos ficam disponiveis offline sem ninguem marcar um por um. A
  // marcacao manual continua existindo, mas deixou de ser o que faz o offline
  // funcionar.
  useChecklistsCacheAutomatico(modelos);

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

  /**
   * Média de conformidade das aplicações CONCLUÍDAS.
   *
   * Duas correções aqui. A soma percorria todas as aplicações e dividia pelo número
   * de concluídas — aplicação em andamento com percentual parcial gravado entrava no
   * numerador e não no denominador, inflando a média. E o valor inicial era 100:
   * sem nenhum checklist concluído, o painel exibia conformidade total, que é o
   * oposto do que "nenhum dado" significa.
   *
   * Agora é `null` quando não há base, e a tela mostra "—".
   */
  const aplicacoesConcluidas = aplicacoes.filter((a) => a.status === "concluido");

  const mediaConformidade =
    aplicacoesConcluidas.length === 0
      ? null
      : Math.round(
          aplicacoesConcluidas.reduce(
            (acc, curr) => acc + (curr.percentual_conformidade || 0),
            0
          ) / aplicacoesConcluidas.length
        );

  // Breakdown visual dos Planos de Ação: status (rosca) + ranking por obra,
  // checklist e responsável. Calculado sobre `planosStats` (não paginado) — a
  // tabela paginada da aba "Planos" mostraria só a página atual.
  const planosPorStatus = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of planosStats) {
      contagem.set(p.status, (contagem.get(p.status) || 0) + 1);
    }
    return Array.from(contagem.entries()).map(([status, total]) => ({
      name: STATUS_PLANO_LABEL[status] || status,
      value: total,
      fill: STATUS_PLANO_COR[status] || "#94a3b8",
    }));
  }, [planosStats]);

  const planosPorObra = useMemo(
    () => rankingTopN(planosStats.map((p) => p.projeto_nome)),
    [planosStats]
  );
  const planosPorChecklist = useMemo(
    () => rankingTopN(planosStats.map((p) => p.modelo_nome)),
    [planosStats]
  );
  const planosPorResponsavel = useMemo(
    () => rankingTopN(planosStats.map((p) => p.responsavel_nome)),
    [planosStats]
  );

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
      Resultado: a.reprovado_por_item_critico ? "REPROVADO (item crítico)" : "Aprovado",
      "Conformidade (%)":
        a.percentual_conformidade === null ? "não avaliado" : `${a.percentual_conformidade}%`,
      "Críticos NC": a.itens_criticos_nao_conformes ?? 0,
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
          <Badge variant="outline" className="text-xs font-bold font-mono px-2.5 py-1">
            {statusLabel}
          </Badge>

          <Button
            variant="outline"
            onClick={() => setIsSyncCenterOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <HardDrive className="h-4 w-4 text-primary" /> Central de Sincronização
          </Button>

          {allowEdit && (
            <Button onClick={handleCreateModelo} className="gap-2 text-xs">
              <Plus className="h-4 w-4" /> Novo Modelo de Checklist
            </Button>
          )}
        </div>
      </div>

      {/* Migration Alert Banner if Table Missing */}
      {isTableMissing && (
        <Card className="border-amber-300 bg-amber-50/90 text-amber-900 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              Sincronização de Banco de Dados Pendente (Supabase)
            </CardTitle>
            <CardDescription className="text-xs text-amber-800 leading-relaxed pt-1">
              As tabelas do módulo de Checklists (`checklist_modelos`, `checklist_secoes`, etc.) ainda não foram executadas no projeto Supabase remoto.
              <br />
              Para ativar a criação e preenchimento de checklists, copie o script da migration SQL abaixo e execute no <strong>SQL Editor</strong> do seu Supabase Dashboard:
              <br />
              <code className="bg-amber-100 px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-800 mt-2 block border border-amber-300 select-all">
                supabase/migrations/20260814040000_create_checklists_tables.sql
              </code>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Painel lateral secundário: navegação vertical do módulo em telas largas
          (colapsa para barra horizontal rolável em telas estreitas), com a área
          de conteúdo ao lado — mesmo modelo do Radix Tabs de sempre, só que
          orientado na vertical. */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className="flex flex-col lg:flex-row gap-4 items-start w-full"
      >
        <TabsList className="flex flex-row lg:flex-col h-auto w-full lg:w-56 shrink-0 gap-1 justify-start overflow-x-auto lg:overflow-visible bg-slate-100 p-1.5 rounded-xl lg:sticky lg:top-4">
          <TabsTrigger value="modelos" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <FolderCheck className="h-3.5 w-3.5" /> Modelos ({modelos.length})
          </TabsTrigger>
          <TabsTrigger value="aplicacoes" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <ClipboardCheck className="h-3.5 w-3.5" /> Aplicações ({aplicacoes.length})
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <Calendar className="h-3.5 w-3.5 text-blue-600" /> Agendamentos
          </TabsTrigger>
          <TabsTrigger value="planos" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Planos de Ação 5W2H ({planosAcao.length})
          </TabsTrigger>
          <TabsTrigger value="reincidencias" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <RefreshCcw className="h-3.5 w-3.5 text-purple-600" /> Reincidências ({totalItensComOcorrencia})
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="w-full justify-start gap-1.5 text-xs font-semibold shrink-0">
            <Activity className="h-3.5 w-3.5 text-emerald-600" /> Relatórios & Dashboard
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0 w-full">

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
                      <div className="flex items-center gap-1">
                        {offlineModels.some((om) => om.id === m.id) && (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                            Disponível offline
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px]">
                          {m.categoria}
                        </Badge>
                      </div>
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
                        onClick={() => toggleModelOfflineAvailability.mutate(m)}
                        title={offlineModels.some((om) => om.id === m.id) ? "Remover do modo offline" : "Baixar para uso offline"}
                        className={`h-8 w-8 ${offlineModels.some((om) => om.id === m.id) ? "text-emerald-600 bg-emerald-50 border-emerald-300" : ""}`}
                      >
                        <DownloadCloud className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedModeloForQr(m);
                          setIsQrDialogOpen(true);
                        }}
                        title="QR Code de Campo"
                        className="h-8 w-8 text-primary"
                      >
                        <QrCode className="h-3.5 w-3.5" />
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

                      {allowEdit && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (window.confirm("Tem certeza que deseja excluir este modelo?")) {
                              deleteModelo.mutate(m.id);
                            }
                          }}
                          title="Excluir Modelo"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
                    <TableHead className="text-xs font-bold w-[50px]"></TableHead>
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
                          {/* Reprovado por item crítico aparece ANTES do percentual:
                              97,5% com o extintor obstruído é um número certo com uma
                              conclusão errada, e a linha da lista tem de dizer as
                              duas coisas na ordem em que importam. */}
                          {app.reprovado_por_item_critico && (
                            <Badge
                              variant="outline"
                              className="font-bold text-xs bg-red-100 text-red-800 border-red-400 mb-1 block w-fit"
                              title={`${app.itens_criticos_nao_conformes ?? 0} item(ns) crítico(s) não conforme(s)`}
                            >
                              REPROVADO
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`font-bold text-xs ${
                              app.percentual_conformidade === null
                                ? "bg-slate-100 text-slate-700 border-slate-300"
                                : app.percentual_conformidade >= 90
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : app.percentual_conformidade >= 70
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-red-100 text-red-800 border-red-300"
                            }`}
                          >
                            {app.percentual_conformidade === null
                              ? "não avaliado"
                              : `${app.percentual_conformidade}%`}
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
                        <TableCell>
                          {allowEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir esta aplicação?")) {
                                  deleteAplicacao.mutate(app.id);
                                }
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
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
              <TablePagination
                currentPage={pageApl + 1}
                totalPages={totalPagesApl}
                onPageChange={(pg) => setPageApl(pg - 1)}
                itemsPerPage={pageSizeApl}
                onItemsPerPageChange={(v) => {
                  setPageSizeApl(v);
                  setPageApl(0);
                }}
                totalItems={totalAplicacoes}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: AGENDAMENTOS RECORRENTES */}
        <TabsContent value="agendamentos">
          <ChecklistAgendamentosTab />
        </TabsContent>

        {/* TAB 4: PLANOS DE AÇÃO 5W2H */}
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
              {/* Rolagem horizontal própria: com Por Quê/Como/Onde inline (como no
                  detalhamento do Checklist Fácil), a tabela fica mais larga que a
                  viewport em telas médias — e é a tabela que deve rolar, não a
                  página inteira. */}
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Código / O que (What)</TableHead>
                    <TableHead className="text-xs font-bold min-w-[160px]">Por quê (Why)</TableHead>
                    <TableHead className="text-xs font-bold min-w-[160px]">Como (How)</TableHead>
                    <TableHead className="text-xs font-bold min-w-[120px]">Onde (Where)</TableHead>
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
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-xs text-muted-foreground">Carregando planos de ação 5W2H...</TableCell></TableRow>
                  ) : filteredPlanos.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-xs text-muted-foreground">Nenhum plano de ação registrado.</TableCell></TableRow>
                  ) : (
                    filteredPlanos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-bold text-xs text-foreground max-w-[220px]">{p.o_que_fazer}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{p.codigo || "PA"}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={p.por_que || undefined}>
                          {p.por_que || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={p.como_fazer || undefined}>
                          {p.como_fazer || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={p.onde || undefined}>
                          {p.onde || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-red-600 whitespace-nowrap">{p.quando_prazo || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{p.quem_responsavel?.nome || "—"}</TableCell>
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
                            <a href={resolveFileUrl(p.evidencia_conclusao_r2_url)} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1 whitespace-nowrap">
                              <FileCheck className="h-3.5 w-3.5" /> Evidência R2
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenPlano(p)} className="text-xs gap-1 text-primary whitespace-nowrap">
                            <Edit2 className="h-3.5 w-3.5" /> Tratar / Evidência
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <TablePagination
                currentPage={pagePlano + 1}
                totalPages={totalPagesPlano}
                onPageChange={(pg) => setPagePlano(pg - 1)}
                itemsPerPage={pageSizePlano}
                onItemsPerPageChange={(v) => {
                  setPageSizePlano(v);
                  setPagePlano(0);
                }}
                totalItems={totalPlanos}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: RELATÓRIOS & DASHBOARD */}
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
                {/* "—" quando não há checklist concluído: sem base, nenhum número é
                    verdade — e 100% seria a leitura mais enganosa possível. */}
                <div className="text-2xl font-bold text-emerald-700">
                  {mediaConformidade === null ? "—" : `${mediaConformidade}%`}
                </div>
                {mediaConformidade === null && (
                  <p className="text-[11px] text-muted-foreground">
                    nenhum checklist concluído
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {planosStatsTruncado && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              O total de planos de ação passou do teto de segurança da consulta ({CHECKLIST_STATS_LIMITE_LINHAS}{" "}
              registros). Os gráficos abaixo cobrem os mais recentes, não o histórico completo.
            </p>
          )}

          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Breakdown de Planos de Ação
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold">Status dos Planos</CardTitle>
                </CardHeader>
                <CardContent className="h-[240px] pt-2">
                  {planosStats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem planos de ação registrados.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planosPorStatus}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {planosPorStatus.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Ranking por Obra/Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[240px] pt-2">
                  {planosPorObra.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados suficientes.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planosPorObra} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <FolderCheck className="h-3.5 w-3.5 text-primary" /> Ranking por Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[240px] pt-2">
                  {planosPorChecklist.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados suficientes.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planosPorChecklist} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Ranking por Responsável
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[240px] pt-2">
                  {planosPorResponsavel.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados suficientes.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planosPorResponsavel} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: REINCIDÊNCIAS */}
        <TabsContent value="reincidencias" className="space-y-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-purple-600" /> Itens Reincidentes
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                O mesmo item reprovado mais de uma vez na mesma obra, ao longo do tempo. Isolado, cada
                checklist reprovado é um evento; reincidente, é padrão — o que costuma anteceder acidente
                ou multa, não o evento isolado.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mostrar a partir de</Label>
              <Select value={String(minOcorrenciasReincidencia)} onValueChange={(v) => setMinOcorrenciasReincidencia(Number(v))}>
                <SelectTrigger className="text-xs w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2+ ocorrências</SelectItem>
                  <SelectItem value="3">3+ ocorrências</SelectItem>
                  <SelectItem value="5">5+ ocorrências</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {reincidenciasTruncado && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              O histórico de respostas não conformes passou do teto de segurança da consulta. As
              reincidências abaixo cobrem as ocorrências mais recentes, não o histórico completo.
            </p>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-bold">Item do Checklist</TableHead>
                    <TableHead className="text-xs font-bold">Obra/Projeto</TableHead>
                    <TableHead className="text-xs font-bold text-center">Ocorrências</TableHead>
                    <TableHead className="text-xs font-bold">Primeira Ocorrência</TableHead>
                    <TableHead className="text-xs font-bold">Última Ocorrência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingReincidencias ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">Calculando reincidências...</TableCell></TableRow>
                  ) : reincidencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                        Nenhum item reincidente com {minOcorrenciasReincidencia}+ ocorrências. Isso é bom sinal — ou ainda não
                        há histórico suficiente para revelar um padrão.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reincidencias.map((r) => (
                      <TableRow key={r.chave}>
                        <TableCell className="text-xs font-bold text-foreground max-w-[280px]">{r.item_titulo}</TableCell>
                        <TableCell className="text-xs">{r.projeto_nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`font-bold text-xs ${
                              r.ocorrencias >= 5
                                ? "bg-red-100 text-red-800 border-red-300"
                                : r.ocorrencias >= 3
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {r.ocorrencias}x
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.primeira_ocorrencia ? format(parseISO(r.primeira_ocorrencia), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.ultima_ocorrencia ? format(parseISO(r.ultima_ocorrencia), "dd/MM/yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        </div>
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

      {/* QR Code Dialog */}
      <ChecklistQrCodeDialog
        open={isQrDialogOpen}
        onOpenChange={setIsQrDialogOpen}
        modelo={selectedModeloForQr}
      />

      {/* Sync Center Dialog */}
      <ChecklistSyncCenterDialog
        open={isSyncCenterOpen}
        onOpenChange={setIsSyncCenterOpen}
      />
    </div>
  );
}
