import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSgsstCounts } from "@/hooks/sgsst/useSgsstCounts";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { useSgsstPcmso, SgsstPcmso, StatusPcmso } from "@/hooks/sgsst/useSgsstPcmso";
import {
  useSgsstAsos,
  useSgsstExames,
  SgsstAso,
  SgsstExame,
  AptidaoAso,
  TipoExameOcupacional,
  StatusExameOcupacional,
  calculateVencimentoAso,
} from "@/hooks/sgsst/useSgsstAsosAndExames";
import { useSgsstColaboradoresResumo } from "@/hooks/sgsst/useSgsstColaboradores";
import { gerarPdfAso, pendenciasAso } from "@/lib/asoDocumento";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SgsstErrorState } from "@/components/sgsst/SgsstStateFeedback";
import { SgsstCatsTab } from "@/components/sgsst/SgsstCatsTab";
import { SgsstRelatorioAnaliticoTab } from "@/components/sgsst/SgsstRelatorioAnaliticoTab";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  HeartPulse,
  Eye,
  CheckCircle2,
  XCircle,
  Lock,
  RefreshCw,
  Stethoscope,
  FileText,
  AlertTriangle,
  Clock,
  CheckSquare,
  Siren,
  ClipboardList,
} from "lucide-react";
import { SgsstConfirmDelete } from "@/components/sgsst/SgsstConfirmDelete";
import { PcmsoFormDialog } from "@/components/sgsst/PcmsoFormDialog";
import { AsoFormDialog } from "@/components/sgsst/AsoFormDialog";
import { AsoDetailDialog } from "@/components/sgsst/AsoDetailDialog";
import { ExameFormDialog } from "@/components/sgsst/ExameFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

export default function SgsstPcmsoListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pcmso");

  // Tab State
  const [activeTab, setActiveTab] = useState("pcmso");

  // PCMSO Search & Filters
  const [pagePcmso, setPagePcmso] = useState(0);
  const [pageSizePcmso, setPageSizePcmso] = useState(25);
  const [searchTermPcmso, setSearchTermPcmso] = useState("");
  const debouncedSearchPcmso = useDebounce(searchTermPcmso, 400);
  const [selectedStatusPcmso, setSelectedStatusPcmso] = useState<string>("todos");
  const [isPcmsoFormOpen, setIsPcmsoFormOpen] = useState(false);
  const [editingPcmso, setEditingPcmso] = useState<SgsstPcmso | null>(null);

  // ASO Search & Filters
  const [pageAso, setPageAso] = useState(0);
  const [pageSizeAso, setPageSizeAso] = useState(25);
  const [searchTermAso, setSearchTermAso] = useState("");
  const debouncedSearchAso = useDebounce(searchTermAso, 400);
  const [filterColabAso, setFilterColabAso] = useState("todos");
  const [filterTipoAso, setFilterTipoAso] = useState("todos");
  const [filterAptidaoAso, setFilterAptidaoAso] = useState("todos");
  const [filterVencimentoAso, setFilterVencimentoAso] = useState("todos");
  const [filterPcmsoAso, setFilterPcmsoAso] = useState("todos");
  const [isAsoFormOpen, setIsAsoFormOpen] = useState(false);
  const [editingAso, setEditingAso] = useState<SgsstAso | null>(null);
  const [viewingAso, setViewingAso] = useState<SgsstAso | null>(null);
  const [isAsoDetailOpen, setIsAsoDetailOpen] = useState(false);
  const [initialExameForAso, setInitialExameForAso] = useState<string | null>(null);

  // Exame Search & Filters
  const [pageExame, setPageExame] = useState(0);
  const [pageSizeExame, setPageSizeExame] = useState(25);
  const [searchTermExame, setSearchTermExame] = useState("");
  const debouncedSearchExame = useDebounce(searchTermExame, 400);
  const [filterStatusExame, setFilterStatusExame] = useState("todos");
  const [isExameFormOpen, setIsExameFormOpen] = useState(false);
  const [editingExame, setEditingExame] = useState<SgsstExame | null>(null);

  // Hooks — declarados depois dos filtros porque agora recebem os filtros como
  // parametro: busca, filtros e paginacao passaram a rodar no servidor, de modo
  // que o recorte considera a base inteira e nao apenas a pagina carregada.
  const {
    pcmsoList,
    total: totalPcmso,
    isLoading: loadingPcmso,
    error: errPcmso,
    refetch: refetchPcmso,
    createPcmso,
    updatePcmso,
    removePcmso,
  } = useSgsstPcmso({
    page: pagePcmso,
    pageSize: pageSizePcmso,
    search: debouncedSearchPcmso,
    status: selectedStatusPcmso,
  });

  const {
    asos,
    total: totalAso,
    isLoading: loadingAsos,
    error: errAsos,
    createAso,
    updateAso,
    cancelAso,
    removeAso,
  } = useSgsstAsos({
    page: pageAso,
    pageSize: pageSizeAso,
    search: debouncedSearchAso,
    tipo: filterTipoAso,
    aptidao: filterAptidaoAso,
    colaboradorId: filterColabAso,
    pcmsoId: filterPcmsoAso,
    vencimento: filterVencimentoAso,
  });

  const {
    exames,
    total: totalExame,
    isLoading: loadingExames,
    error: errExames,
    createExame,
    updateExame,
    removeExame,
  } = useSgsstExames({
    page: pageExame,
    pageSize: pageSizeExame,
    search: debouncedSearchExame,
    status: filterStatusExame,
  });

  const { colaboradores } = useSgsstColaboradoresResumo();
  const { profile } = useAuth();

  /** ASO sendo emitido, para desabilitar só o botão daquela linha. */
  const [asoEmitindoId, setAsoEmitindoId] = useState<string | null>(null);

  /**
   * Emite o ASO em PDF. Avisa sobre campos obrigatórios vazios sem bloquear —
   * mas aqui o aviso é mais firme que no PCMSO, porque o ASO é o documento que
   * vai para a mão do trabalhador e um campo em branco é autuação direta.
   */
  const handleEmitirAso = async (aso: SgsstAso) => {
    const pendencias = pendenciasAso(aso);

    if (pendencias.length > 0) {
      toast.warning(`ASO com ${pendencias.length} campo(s) obrigatório(s) em branco`, {
        description: pendencias.join(" · "),
        duration: 10000,
      });
    }

    setAsoEmitindoId(aso.id);
    try {
      await gerarPdfAso(aso, profile?.nome ?? null);
      toast.success("ASO gerado.");
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      toast.error(`Não foi possível gerar o ASO: ${detalhe}`);
    } finally {
      setAsoEmitindoId(null);
    }
  };

  const totalPagesPcmso = Math.ceil(totalPcmso / pageSizePcmso) || 1;
  const totalPagesAso = Math.ceil(totalAso / pageSizeAso) || 1;
  const totalPagesExame = Math.ceil(totalExame / pageSizeExame) || 1;

  // Voltar à primeira página quando os filtros mudam, senão a consulta pede um
  // range que o resultado filtrado não tem e a tabela aparece vazia.
  useEffect(() => {
    setPagePcmso(0);
  }, [debouncedSearchPcmso, selectedStatusPcmso]);

  useEffect(() => {
    setPageAso(0);
  }, [
    debouncedSearchAso,
    filterTipoAso,
    filterAptidaoAso,
    filterColabAso,
    filterPcmsoAso,
    filterVencimentoAso,
  ]);

  useEffect(() => {
    setPageExame(0);
  }, [debouncedSearchExame, filterStatusExame]);

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  // Indicadores de Saúde Ocupacional.
  // Antes eram calculados com `exames.filter(...)` / `asos.filter(...)` sobre a
  // página carregada, então "ASOs vencidos" só contava os vencidos visíveis —
  // justamente o número que não pode ser subestimado. Agora são contagens do
  // servidor sobre a base inteira.
  const hojeIso = new Date().toISOString().slice(0, 10);
  const limiteAvisoIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const { count: countExames } = useSgsstCounts("sgsst_exames", [
    { key: "pendentes", build: (q) => q.in("status", ["PENDENTE", "AGENDADO"]) },
    { key: "realizados", build: (q) => q.eq("status", "REALIZADO") },
  ]);

  const { count: countAsos } = useSgsstCounts("sgsst_asos", [
    { key: "validos", build: (q) => q.eq("status", "ATIVO").gt("validade", limiteAvisoIso) },
    {
      key: "proximos",
      build: (q) =>
        q.eq("status", "ATIVO").gte("validade", hojeIso).lte("validade", limiteAvisoIso),
    },
    { key: "vencidos", build: (q) => q.eq("status", "ATIVO").lt("validade", hojeIso) },
  ]);

  const examesPendentesCount = countExames("pendentes");
  const examesRealizadosCount = countExames("realizados");
  const asosValidosCount = countAsos("validos");
  const asosProximosCount = countAsos("proximos");
  const asosVencidosCount = countAsos("vencidos");

  // Handlers PCMSO
  const handleSavePcmso = async (data: any) => {
    if (editingPcmso) {
      await updatePcmso.mutateAsync({ id: editingPcmso.id, ...data });
    } else {
      await createPcmso.mutateAsync(data);
    }
  };

  // Handlers ASO
  const handleSaveAso = async (data: any) => {
    if (editingAso) {
      await updateAso.mutateAsync({ id: editingAso.id, ...data });
    } else {
      await createAso.mutateAsync(data);
    }
  };

  const handleEmitAsoFromExame = (exameId: string) => {
    setInitialExameForAso(exameId);
    setEditingAso(null);
    setIsAsoFormOpen(true);
  };

  // Handlers Exame
  const handleSaveExame = async (data: any) => {
    if (editingExame) {
      await updateExame.mutateAsync({ id: editingExame.id, ...data });
    } else {
      await createExame.mutateAsync(data);
    }
  };

  const getAptidaoBadge = (apt: AptidaoAso) => {
    switch (apt) {
      case "APTO":
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">APTO</Badge>;
      case "APTO_COM_RESTRICAO":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">APTO C/ RESTRIÇÃO</Badge>;
      case "INAPTO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">INAPTO</Badge>;
      default:
        return <Badge variant="outline">{apt}</Badge>;
    }
  };

  const getVencimentoBadge = (statusVenc?: string) => {
    switch (statusVenc) {
      case "VALIDO":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">VÁLIDO</Badge>;
      case "PROXIMO_VENCIMENTO":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> PRÓX. VENCIMENTO</Badge>;
      case "VENCIDO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> VENCIDO</Badge>;
      default:
        return null;
    }
  };

  // Basta um dos hooks falhar para varias abas ficarem vazias; o banner diz
  // qual e a causa em vez de deixar as tabelas parecerem sem cadastro.
  const erroModulo = errPcmso ?? errAsos ?? errExames;

  return (
    <div className="space-y-6">
      {/* Top Main Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <HeartPulse className="h-6 w-6 text-primary" />
            SGSST — Saúde Ocupacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão Integrada de PCMSO (NR-7), Atestados de Saúde Ocupacional (ASO) e Exames Clínicos e Complementares.
          </p>
        </div>
        {allowEdit && (
          <div className="flex items-center gap-2">
            {activeTab === "pcmso" && (
              <Button onClick={() => { setEditingPcmso(null); setIsPcmsoFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Elaborar PCMSO
              </Button>
            )}
            {activeTab === "aso" && (
              <Button onClick={() => { setEditingAso(null); setInitialExameForAso(null); setIsAsoFormOpen(true); }} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" /> Emitir Novo ASO
              </Button>
            )}
            {activeTab === "exames" && (
              <Button onClick={() => { setEditingExame(null); setIsExameFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Solicitar Exame
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Exames Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{examesPendentesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Exames Realizados</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-blue-600">{examesRealizadosCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">ASOs Válidos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-emerald-600">{asosValidosCount}</div>
          </CardContent>
        </Card>
        <Card className={asosProximosCount > 0 ? "border-amber-300 bg-amber-50/20" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Próx. Vencimento (30d)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{asosProximosCount}</div>
          </CardContent>
        </Card>
        <Card className={asosVencidosCount > 0 ? "border-red-300 bg-red-50/30" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">ASOs Vencidos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-red-600">{asosVencidosCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      {erroModulo && (
        <SgsstErrorState
          error={erroModulo}
          modulo="PCMSO e ASO"
          onRetry={refetchPcmso}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="pcmso" className="gap-2">
            <HeartPulse className="h-4 w-4" /> PCMSO (Programas)
          </TabsTrigger>
          <TabsTrigger value="aso" className="gap-2">
            <Stethoscope className="h-4 w-4" /> ASO — Atestados ({totalAso})
          </TabsTrigger>
          <TabsTrigger value="exames" className="gap-2">
            <FileText className="h-4 w-4" /> Exames Ocupacionais ({totalExame})
          </TabsTrigger>
          <TabsTrigger value="cats" className="gap-2">
            <Siren className="h-4 w-4" /> CATs
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Relatório Analítico
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PCMSO */}
        <TabsContent value="pcmso" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, médico, código ou obra..."
                value={searchTermPcmso}
                onChange={(e) => setSearchTermPcmso(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedStatusPcmso} onValueChange={setSelectedStatusPcmso}>
              <SelectTrigger className="w-[150px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="EM_REVISAO">Em Revisão</SelectItem>
                <SelectItem value="ENCERRADO">Encerrado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título do PCMSO</TableHead>
                    <TableHead>Médico Responsável / CRM</TableHead>
                    <TableHead>Obra / Escopo</TableHead>
                    <TableHead>Início Vigência</TableHead>
                    <TableHead>Prev. Revisão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPcmso ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando programas de PCMSO...</TableCell></TableRow>
                  ) : pcmsoList.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum PCMSO encontrado.</TableCell></TableRow>
                  ) : (
                    pcmsoList.map((p) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/medicoes/sgsst/pcmso/${p.id}`)}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo || "—"}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{p.titulo}</TableCell>
                        <TableCell className="text-xs">
                          <div>{p.medico_responsavel || "Não informado"}</div>
                          <div className="text-muted-foreground font-mono text-[11px]">{p.crm_medico || ""}</div>
                        </TableCell>
                        <TableCell className="text-xs">{p.projeto ? `[${p.projeto.codigo}] ${p.projeto.nome}` : "Geral da Empresa"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(p.data_inicio)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(p.data_revisao)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/medicoes/sgsst/pcmso/${p.id}`); }} title="Visualizar">
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pagePcmso + 1}
                totalPages={totalPagesPcmso}
                onPageChange={(p) => setPagePcmso(p - 1)}
                itemsPerPage={pageSizePcmso}
                onItemsPerPageChange={(v) => {
                  setPageSizePcmso(v);
                  setPagePcmso(0);
                }}
                totalItems={totalPcmso}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ASO */}
        <TabsContent value="aso" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador, CPF ou doc ASO..."
                value={searchTermAso}
                onChange={(e) => setSearchTermAso(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterAptidaoAso} onValueChange={setFilterAptidaoAso}>
                <SelectTrigger className="w-[120px] text-xs">
                  <SelectValue placeholder="Aptidão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Aptidões</SelectItem>
                  <SelectItem value="APTO">Apto</SelectItem>
                  <SelectItem value="APTO_COM_RESTRICAO">Apto c/ Restrição</SelectItem>
                  <SelectItem value="INAPTO">Inapto</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterVencimentoAso} onValueChange={setFilterVencimentoAso}>
                <SelectTrigger className="w-[140px] text-xs">
                  <SelectValue placeholder="Vencimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Vencimentos</SelectItem>
                  <SelectItem value="VALIDO">Válidos</SelectItem>
                  <SelectItem value="PROXIMO_VENCIMENTO">Próx. Vencimento</SelectItem>
                  <SelectItem value="VENCIDO">Vencidos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterTipoAso} onValueChange={setFilterTipoAso}>
                <SelectTrigger className="w-[120px] text-xs">
                  <SelectValue placeholder="Tipo Exame" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Tipos</SelectItem>
                  <SelectItem value="Admissional">Admissional</SelectItem>
                  <SelectItem value="Periódico">Periódico</SelectItem>
                  <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                  <SelectItem value="Mudança de Risco/Função">Mudança de Risco/Função</SelectItem>
                  <SelectItem value="Demissional">Demissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador / Trabalhador</TableHead>
                    <TableHead>Documento / N°</TableHead>
                    <TableHead>Tipo Exame</TableHead>
                    <TableHead>Aptidão</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAsos ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando atestados de ASO...</TableCell></TableRow>
                  ) : asos.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum ASO encontrado.</TableCell></TableRow>
                  ) : (
                    asos.map((a) => {
                      const colabNome = a.colaborador?.profile?.nome || a.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setViewingAso(a); setIsAsoDetailOpen(true); }}>
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm">{colabNome}</div>
                            <div className="text-[11px] text-muted-foreground">CPF: {a.colaborador?.cpf || "—"} | {a.colaborador?.funcao?.nome || "Sem Função"}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{a.numero_documento || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{a.tipo}</Badge></TableCell>
                          <TableCell>{getAptidaoBadge(a.aptidao)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(a.data_emissao)}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">{formatDateStr(a.validade)}</TableCell>
                          <TableCell>{getVencimentoBadge(a.statusVencimento)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingAso(a);
                                  setIsAsoDetailOpen(true);
                                }}
                                title="Detalhes do ASO"
                              >
                                <Eye className="h-4 w-4 text-primary" />
                              </Button>

                              {/* Emitir fica disponível para quem só consulta: o
                                  trabalhador tem direito à via do atestado, e
                                  auditoria não deveria exigir permissão de edição. */}
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={asoEmitindoId === a.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEmitirAso(a);
                                }}
                                title="Emitir ASO em PDF"
                              >
                                <FileText
                                  className={`h-4 w-4 ${
                                    asoEmitindoId === a.id
                                      ? "text-muted-foreground"
                                      : "text-indigo-600"
                                  }`}
                                />
                              </Button>

                              {allowEdit && a.status === "ATIVO" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAso(a);
                                      setIsAsoFormOpen(true);
                                    }}
                                    title="Editar ASO"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelAso.mutate({ id: a.id });
                                    }}
                                    title="Cancelar ASO"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pageAso + 1}
                totalPages={totalPagesAso}
                onPageChange={(p) => setPageAso(p - 1)}
                itemsPerPage={pageSizeAso}
                onItemsPerPageChange={(v) => {
                  setPageSizeAso(v);
                  setPageAso(0);
                }}
                totalItems={totalAso}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: EXAMES OCUPACIONAIS */}
        <TabsContent value="exames" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do exame, colaborador..."
                value={searchTermExame}
                onChange={(e) => setSearchTermExame(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatusExame} onValueChange={setFilterStatusExame}>
              <SelectTrigger className="w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="AGENDADO">Agendado</SelectItem>
                <SelectItem value="REALIZADO">Realizado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Exame</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo Exame</TableHead>
                    <TableHead>Solicitação</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExames ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando exames ocupacionais...</TableCell></TableRow>
                  ) : exames.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum exame cadastrado.</TableCell></TableRow>
                  ) : (
                    exames.map((e) => {
                      const colabNome = e.colaborador?.profile?.nome || e.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-semibold text-xs sm:text-sm">{e.nome_exame}</TableCell>
                          <TableCell className="text-xs">{colabNome}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{e.tipo}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(e.data_solicitacao)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(e.data_realizacao)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs font-bold">{e.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {allowEdit && e.status === "REALIZADO" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs gap-1 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                  onClick={() => handleEmitAsoFromExame(e.id)}
                                >
                                  <Stethoscope className="h-3.5 w-3.5" /> Emitir ASO
                                </Button>
                              )}

                              {allowEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingExame(e);
                                      setIsExameFormOpen(true);
                                    }}
                                    title="Editar Exame"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <SgsstConfirmDelete
                                    alvo="este exame ocupacional"
                                    consequencia={"O exame e seu resultado são apagados. Se houver ASO emitido a partir dele, o vínculo é perdido."}
                                    onConfirm={() => removeExame.mutate(e.id)}
                                  />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={pageExame + 1}
                totalPages={totalPagesExame}
                onPageChange={(p) => setPageExame(p - 1)}
                itemsPerPage={pageSizeExame}
                onItemsPerPageChange={(v) => {
                  setPageSizeExame(v);
                  setPageExame(0);
                }}
                totalItems={totalExame}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cats" className="space-y-4 pt-4">
          <SgsstCatsTab />
        </TabsContent>

        <TabsContent value="relatorio" className="space-y-4 pt-4">
          <SgsstRelatorioAnaliticoTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PcmsoFormDialog
        open={isPcmsoFormOpen}
        onOpenChange={setIsPcmsoFormOpen}
        pcmso={editingPcmso}
        onSave={handleSavePcmso}
      />

      <AsoFormDialog
        open={isAsoFormOpen}
        onOpenChange={setIsAsoFormOpen}
        aso={editingAso}
        initialExameId={initialExameForAso}
        onSave={handleSaveAso}
        isLoading={createAso.isPending || updateAso.isPending}
      />

      <AsoDetailDialog
        open={isAsoDetailOpen}
        onOpenChange={setIsAsoDetailOpen}
        aso={viewingAso}
      />

      <ExameFormDialog
        open={isExameFormOpen}
        onOpenChange={setIsExameFormOpen}
        exame={editingExame}
        onSave={handleSaveExame}
        isLoading={createExame.isPending || updateExame.isPending}
      />
    </div>
  );
}
