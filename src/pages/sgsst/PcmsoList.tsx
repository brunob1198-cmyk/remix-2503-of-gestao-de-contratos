import { useState } from "react";
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
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
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

  // Hooks
  const { pcmsoList, isLoading: loadingPcmso, createPcmso, updatePcmso, removePcmso } = useSgsstPcmso();
  const { asos, isLoading: loadingAsos, createAso, updateAso, cancelAso, removeAso } = useSgsstAsos();
  const { exames, isLoading: loadingExames, createExame, updateExame, removeExame } = useSgsstExames();
  const { colaboradores } = useSgsstColaboradoresResumo();

  // Tab State
  const [activeTab, setActiveTab] = useState("pcmso");

  // PCMSO Search & Filters
  const [searchTermPcmso, setSearchTermPcmso] = useState("");
  const [selectedStatusPcmso, setSelectedStatusPcmso] = useState<string>("todos");
  const [isPcmsoFormOpen, setIsPcmsoFormOpen] = useState(false);
  const [editingPcmso, setEditingPcmso] = useState<SgsstPcmso | null>(null);

  // ASO Search & Filters
  const [searchTermAso, setSearchTermAso] = useState("");
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
  const [searchTermExame, setSearchTermExame] = useState("");
  const [filterStatusExame, setFilterStatusExame] = useState("todos");
  const [isExameFormOpen, setIsExameFormOpen] = useState(false);
  const [editingExame, setEditingExame] = useState<SgsstExame | null>(null);

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  // PCMSO Filtered
  const filteredPcmsoList = pcmsoList.filter((p) => {
    const term = searchTermPcmso.toLowerCase();
    const matchesSearch =
      p.titulo.toLowerCase().includes(term) ||
      (p.codigo && p.codigo.toLowerCase().includes(term)) ||
      (p.medico_responsavel && p.medico_responsavel.toLowerCase().includes(term)) ||
      (p.projeto?.nome && p.projeto.nome.toLowerCase().includes(term));

    const matchesStatus = selectedStatusPcmso === "todos" || p.status === selectedStatusPcmso;
    return matchesSearch && matchesStatus;
  });

  // ASO Filtered
  const filteredAsos = asos.filter((a) => {
    const term = searchTermAso.toLowerCase();
    const colabNome = a.colaborador?.profile?.nome || a.colaborador?.recurso?.nome || "";
    const matchesSearch =
      colabNome.toLowerCase().includes(term) ||
      (a.numero_documento && a.numero_documento.toLowerCase().includes(term)) ||
      (a.colaborador?.cpf && a.colaborador.cpf.includes(term));

    const matchesColab = filterColabAso === "todos" || a.colaborador_id === filterColabAso;
    const matchesTipo = filterTipoAso === "todos" || a.tipo === filterTipoAso;
    const matchesAptidao = filterAptidaoAso === "todos" || a.aptidao === filterAptidaoAso;
    const matchesVencimento = filterVencimentoAso === "todos" || a.statusVencimento === filterVencimentoAso;
    const matchesPcmso = filterPcmsoAso === "todos" || a.pcmso_id === filterPcmsoAso;

    return matchesSearch && matchesColab && matchesTipo && matchesAptidao && matchesVencimento && matchesPcmso;
  });

  // Exame Filtered
  const filteredExames = exames.filter((e) => {
    const term = searchTermExame.toLowerCase();
    const colabNome = e.colaborador?.profile?.nome || e.colaborador?.recurso?.nome || "";
    const matchesSearch =
      e.nome_exame.toLowerCase().includes(term) ||
      colabNome.toLowerCase().includes(term) ||
      (e.medico_responsavel && e.medico_responsavel.toLowerCase().includes(term));

    const matchesStatus = filterStatusExame === "todos" || e.status === filterStatusExame;

    return matchesSearch && matchesStatus;
  });

  // Dashboard Stats Calculations for Saúde Ocupacional
  const examesPendentesCount = exames.filter((e) => e.status === "PENDENTE" || e.status === "AGENDADO").length;
  const examesRealizadosCount = exames.filter((e) => e.status === "REALIZADO").length;
  const asosValidosCount = asos.filter((a) => a.status === "ATIVO" && a.statusVencimento === "VALIDO").length;
  const asosProximosCount = asos.filter((a) => a.status === "ATIVO" && a.statusVencimento === "PROXIMO_VENCIMENTO").length;
  const asosVencidosCount = asos.filter((a) => a.status === "ATIVO" && a.statusVencimento === "VENCIDO").length;

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-3">
          <TabsTrigger value="pcmso" className="gap-2">
            <HeartPulse className="h-4 w-4" /> PCMSO (Programas)
          </TabsTrigger>
          <TabsTrigger value="aso" className="gap-2">
            <Stethoscope className="h-4 w-4" /> ASO — Atestados ({asos.length})
          </TabsTrigger>
          <TabsTrigger value="exames" className="gap-2">
            <FileText className="h-4 w-4" /> Exames Ocupacionais ({exames.length})
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
                  ) : filteredPcmsoList.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum PCMSO encontrado.</TableCell></TableRow>
                  ) : (
                    filteredPcmsoList.map((p) => (
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
                  ) : filteredAsos.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum ASO encontrado.</TableCell></TableRow>
                  ) : (
                    filteredAsos.map((a) => {
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
                  ) : filteredExames.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum exame cadastrado.</TableCell></TableRow>
                  ) : (
                    filteredExames.map((e) => {
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeExame.mutate(e.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
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
            </CardContent>
          </Card>
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
