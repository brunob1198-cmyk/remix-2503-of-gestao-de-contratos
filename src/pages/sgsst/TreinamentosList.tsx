import { useState } from "react";
import {
  useSgsstTreinamentos,
  useSgsstTreinamentosTurmas,
  useSgsstTreinamentosParticipantes,
  useSgsstTodosParticipantes,
  SgsstTreinamento,
  SgsstTreinamentoTurma,
  SgsstTreinamentoParticipante,
  CategoriaTreinamento,
} from "@/hooks/sgsst/useSgsstTreinamentos";
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
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  FileCheck,
  UserCheck,
} from "lucide-react";
import { TreinamentoFormDialog } from "@/components/sgsst/TreinamentoFormDialog";
import { TurmaFormDialog } from "@/components/sgsst/TurmaFormDialog";
import { ParticipanteFormDialog } from "@/components/sgsst/ParticipanteFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";

export default function SgsstTreinamentosListPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-treinamentos");

  const { treinamentos, isLoading: loadingTreinamentos, createTreinamento, updateTreinamento, removeTreinamento } = useSgsstTreinamentos();
  const { turmas, isLoading: loadingTurmas, createTurma, updateTurma, removeTurma } = useSgsstTreinamentosTurmas();
  const { todosParticipantes, isLoading: loadingTodosPart } = useSgsstTodosParticipantes();

  // Tab State
  const [activeTab, setActiveTab] = useState("catalogo");

  // Catálogo Filters
  const [searchTermCat, setSearchTermCat] = useState("");
  const [filterCat, setFilterCat] = useState("todos");
  const [isTrFormOpen, setIsTrFormOpen] = useState(false);
  const [editingTr, setEditingTr] = useState<SgsstTreinamento | null>(null);

  // Turmas Filters
  const [searchTermTurma, setSearchTermTurma] = useState("");
  const [filterStatusTurma, setFilterStatusTurma] = useState("todos");
  const [isTurmaFormOpen, setIsTurmaFormOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<SgsstTreinamentoTurma | null>(null);

  // Managing Participants for a specific Turma
  const [selectedTurmaForPart, setSelectedTurmaForPart] = useState<SgsstTreinamentoTurma | null>(null);
  const { participantes: turmaParticipantes, addParticipante, updateParticipante, removeParticipante } = useSgsstTreinamentosParticipantes(selectedTurmaForPart?.id);
  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SgsstTreinamentoParticipante | null>(null);

  // Vencimentos Filter
  const [searchTermVenc, setSearchTermVenc] = useState("");
  const [filterVencStatus, setFilterVencStatus] = useState("todos");

  const formatDateStr = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  // Filter Catálogo
  const filteredTreinamentos = treinamentos.filter((t) => {
    const term = searchTermCat.toLowerCase();
    const matchesSearch =
      t.nome.toLowerCase().includes(term) ||
      (t.codigo && t.codigo.toLowerCase().includes(term)) ||
      (t.descricao && t.descricao.toLowerCase().includes(term));

    const matchesCat = filterCat === "todos" || t.categoria === filterCat;
    return matchesSearch && matchesCat;
  });

  // Filter Turmas
  const filteredTurmas = turmas.filter((t) => {
    const term = searchTermTurma.toLowerCase();
    const trNome = t.treinamento?.nome || "";
    const matchesSearch =
      trNome.toLowerCase().includes(term) ||
      (t.codigo_turma && t.codigo_turma.toLowerCase().includes(term)) ||
      (t.instrutor && t.instrutor.toLowerCase().includes(term));

    const matchesStatus = filterStatusTurma === "todos" || t.status === filterStatusTurma;
    return matchesSearch && matchesStatus;
  });

  // Filter Vencimentos
  const filteredVencimentos = todosParticipantes.filter((p) => {
    const term = searchTermVenc.toLowerCase();
    const colabNome = p.colaborador?.profile?.nome || p.colaborador?.recurso?.nome || "";
    const trNome = p.turma?.treinamento?.nome || "";
    const matchesSearch =
      colabNome.toLowerCase().includes(term) ||
      trNome.toLowerCase().includes(term) ||
      (p.colaborador?.cpf && p.colaborador.cpf.includes(term));

    const matchesVenc = filterVencStatus === "todos" || p.statusVencimento === filterVencStatus;
    return matchesSearch && matchesVenc;
  });

  // Stats Calculations
  const treinamentosAtivosCount = treinamentos.filter((t) => t.status === "ATIVO").length;
  const turmasEmAndamentoCount = turmas.filter((t) => t.status === "EM_ANDAMENTO" || t.status === "PLANEJADA").length;
  const participantesPendentesCount = todosParticipantes.filter((p) => p.resultado === "PENDENTE").length;
  const proximosVencimentoCount = todosParticipantes.filter((p) => p.resultado === "APROVADO" && p.statusVencimento === "PROXIMO_VENCIMENTO").length;
  const vencidosCount = todosParticipantes.filter((p) => p.resultado === "APROVADO" && p.statusVencimento === "VENCIDO").length;

  const getVencimentoBadge = (statusVenc?: string) => {
    switch (statusVenc) {
      case "VALIDO":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">VÁLIDO</Badge>;
      case "PROXIMO_VENCIMENTO":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> PRÓX. VENCIMENTO</Badge>;
      case "VENCIDO":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> VENCIDO</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <GraduationCap className="h-6 w-6 text-primary" />
            SGSST — Treinamentos e Capacitações
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de cursos NRs, turmas presenciais/EAD, lista de presença, aprovação e monitoramento de reciclagens.
          </p>
        </div>

        {allowEdit && (
          <div className="flex items-center gap-2">
            {activeTab === "catalogo" && (
              <Button onClick={() => { setEditingTr(null); setIsTrFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Treinamento
              </Button>
            )}
            {activeTab === "turmas" && (
              <Button onClick={() => { setEditingTurma(null); setIsTurmaFormOpen(true); }} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> Abrir Turma
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 5 Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Treinamentos Ativos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{treinamentosAtivosCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Turmas em Andamento</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-indigo-600">{turmasEmAndamentoCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Alunos Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-blue-600">{participantesPendentesCount}</div>
          </CardContent>
        </Card>

        <Card className={proximosVencimentoCount > 0 ? "border-amber-300 bg-amber-50/20" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Próx. Vencimento (30d)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{proximosVencimentoCount}</div>
          </CardContent>
        </Card>

        <Card className={vencidosCount > 0 ? "border-red-300 bg-red-50/30" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Treinamentos Vencidos</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-red-600">{vencidosCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-4">
          <TabsTrigger value="catalogo" className="gap-2">
            <BookOpen className="h-4 w-4" /> Catálogo ({treinamentos.length})
          </TabsTrigger>
          <TabsTrigger value="turmas" className="gap-2">
            <Users className="h-4 w-4" /> Turmas ({turmas.length})
          </TabsTrigger>
          <TabsTrigger value="participantes" className="gap-2">
            <UserCheck className="h-4 w-4" /> Alunos & Presença ({todosParticipantes.length})
          </TabsTrigger>
          <TabsTrigger value="vencimentos" className="gap-2">
            <Award className="h-4 w-4" /> Reciclagens & Vencimentos
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CATÁLOGO */}
        <TabsContent value="catalogo" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por curso, código ou ementa..."
                value={searchTermCat}
                onChange={(e) => setSearchTermCat(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[160px] text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                <SelectItem value="NR">Norma Regulamentadora (NR)</SelectItem>
                <SelectItem value="Integração">Integração</SelectItem>
                <SelectItem value="Segurança">Segurança</SelectItem>
                <SelectItem value="Saúde">Saúde</SelectItem>
                <SelectItem value="Operacional">Operacional</SelectItem>
                <SelectItem value="Comportamental">Comportamental</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome do Treinamento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Carga Horária</TableHead>
                    <TableHead>Validade (Meses)</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTreinamentos ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando catálogo de treinamentos...</TableCell></TableRow>
                  ) : filteredTreinamentos.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum treinamento encontrado.</TableCell></TableRow>
                  ) : (
                    filteredTreinamentos.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.codigo || "—"}</TableCell>
                        <TableCell className="font-medium max-w-xs">
                          <div>{t.nome}</div>
                          {t.descricao && <div className="text-xs text-muted-foreground truncate">{t.descricao}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t.categoria}</Badge></TableCell>
                        <TableCell className="text-xs font-mono font-bold">{t.carga_horaria}h</TableCell>
                        <TableCell className="text-xs font-mono">{t.validade_meses ? `${t.validade_meses} m` : "Indeterminado"}</TableCell>
                        <TableCell>
                          {t.obrigatorio ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-bold">SIM</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-bold">{t.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {allowEdit && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTr(t);
                                  setIsTrFormOpen(true);
                                }}
                                title="Editar Treinamento"
                              >
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
                                    <AlertDialogTitle>Excluir Treinamento "{t.nome}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Turmas vinculadas a este treinamento também serão removidas.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeTreinamento.mutate(t.id)}>
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

        {/* TAB 2: TURMAS */}
        <TabsContent value="turmas" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por curso, código da turma ou instrutor..."
                value={searchTermTurma}
                onChange={(e) => setSearchTermTurma(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatusTurma} onValueChange={setFilterStatusTurma}>
              <SelectTrigger className="w-[150px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="PLANEJADA">Planejada</SelectItem>
                <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Turma</TableHead>
                    <TableHead>Treinamento / Curso</TableHead>
                    <TableHead>Data Inicial</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Instrutor / Local</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTurmas ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando turmas de treinamentos...</TableCell></TableRow>
                  ) : filteredTurmas.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma turma cadastrada.</TableCell></TableRow>
                  ) : (
                    filteredTurmas.map((turma) => (
                      <TableRow key={turma.id}>
                        <TableCell className="font-mono text-xs font-bold">{turma.codigo_turma || "TURMA"}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{turma.treinamento?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDateStr(turma.data_inicial)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{turma.modalidade}</Badge></TableCell>
                        <TableCell className="text-xs">
                          <div>{turma.instrutor || "Não definido"}</div>
                          <div className="text-muted-foreground text-[11px] truncate">{turma.local || ""}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{turma.capacidade || 30} vagas</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs font-bold">{turma.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1 text-primary border-primary/30"
                              onClick={() => setSelectedTurmaForPart(turma)}
                            >
                              <Users className="h-3.5 w-3.5" /> Gerenciar Alunos
                            </Button>

                            {allowEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingTurma(turma);
                                    setIsTurmaFormOpen(true);
                                  }}
                                  title="Editar Turma"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeTurma.mutate(turma.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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

        {/* TAB 3: PARTICIPANTES / ALUNOS GERAL */}
        <TabsContent value="participantes" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Matrículas e Frequência de Alunos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador / Trabalhador</TableHead>
                    <TableHead>Turma / Treinamento</TableHead>
                    <TableHead>Presença (%)</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Data Conclusão</TableHead>
                    <TableHead>Validade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTodosPart ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando alunos inscritos...</TableCell></TableRow>
                  ) : todosParticipantes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum aluno matriculado.</TableCell></TableRow>
                  ) : (
                    todosParticipantes.map((p) => {
                      const colabNome = p.colaborador?.profile?.nome || p.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm">{colabNome}</div>
                            <div className="text-[11px] text-muted-foreground">CPF: {p.colaborador?.cpf || "—"} | {p.colaborador?.funcao?.nome || "Sem Função"}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{p.turma?.treinamento?.nome}</div>
                            <div className="text-muted-foreground font-mono text-[11px]">Turma: {p.turma?.codigo_turma || "—"}</div>
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold">{p.percentual_presenca}%</TableCell>
                          <TableCell>
                            {p.resultado === "APROVADO" && <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">APROVADO</Badge>}
                            {p.resultado === "REPROVADO" && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">REPROVADO</Badge>}
                            {p.resultado === "PENDENTE" && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">PENDENTE</Badge>}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(p.data_conclusao)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(p.validade)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: VENCIMENTOS E RECICLAGENS */}
        <TabsContent value="vencimentos" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador ou curso..."
                value={searchTermVenc}
                onChange={(e) => setSearchTermVenc(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterVencStatus} onValueChange={setFilterVencStatus}>
              <SelectTrigger className="w-[160px] text-xs">
                <SelectValue placeholder="Situação Reciclagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Situações</SelectItem>
                <SelectItem value="VALIDO">Válidos</SelectItem>
                <SelectItem value="PROXIMO_VENCIMENTO">Próx. Vencimento (30d)</SelectItem>
                <SelectItem value="VENCIDO">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Treinamento Concluído</TableHead>
                    <TableHead>Data da Capacitação</TableHead>
                    <TableHead>Validade / Expiração</TableHead>
                    <TableHead>Situação Reciclagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVencimentos.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro de vencimento encontrado.</TableCell></TableRow>
                  ) : (
                    filteredVencimentos.map((p) => {
                      const colabNome = p.colaborador?.profile?.nome || p.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium text-xs sm:text-sm">{colabNome}</div>
                            <div className="text-[11px] text-muted-foreground">CPF: {p.colaborador?.cpf || "—"} | {p.colaborador?.funcao?.nome || "Sem Função"}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-xs">{p.turma?.treinamento?.nome}</TableCell>
                          <TableCell className="text-xs font-mono">{formatDateStr(p.data_conclusao)}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">{formatDateStr(p.validade)}</TableCell>
                          <TableCell>{getVencimentoBadge(p.statusVencimento)}</TableCell>
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

      {/* Modal Gerenciar Alunos da Turma Selecionada */}
      {selectedTurmaForPart && (
        <Dialog open={!!selectedTurmaForPart} onOpenChange={(open) => !open && setSelectedTurmaForPart(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Alunos da Turma: {selectedTurmaForPart.codigo_turma || selectedTurmaForPart.treinamento?.nome}
                </DialogTitle>
                {allowEdit && (
                  <Button size="sm" onClick={() => { setEditingPart(null); setIsPartFormOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Matricular Aluno
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Presença (%)</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turmaParticipantes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">Nenhum aluno inscrito nesta turma.</TableCell></TableRow>
                  ) : (
                    turmaParticipantes.map((p) => {
                      const colabNome = p.colaborador?.profile?.nome || p.colaborador?.recurso?.nome || "Sem Nome";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs font-semibold">{colabNome}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">{p.percentual_presenca}%</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="font-bold">{p.resultado}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {allowEdit && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingPart(p);
                                    setIsPartFormOpen(true);
                                  }}
                                  title="Registrar Presença / Nota"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => removeParticipante.mutate(p.id)}
                                  title="Remover"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogs */}
      <TreinamentoFormDialog
        open={isTrFormOpen}
        onOpenChange={setIsTrFormOpen}
        treinamento={editingTr}
        onSave={async (data) => {
          if (editingTr) {
            await updateTreinamento.mutateAsync({ id: editingTr.id, ...data });
          } else {
            await createTreinamento.mutateAsync(data);
          }
        }}
      />

      <TurmaFormDialog
        open={isTurmaFormOpen}
        onOpenChange={setIsTurmaFormOpen}
        turma={editingTurma}
        onSave={async (data) => {
          if (editingTurma) {
            await updateTurma.mutateAsync({ id: editingTurma.id, ...data });
          } else {
            await createTurma.mutateAsync(data);
          }
        }}
      />

      <ParticipanteFormDialog
        open={isPartFormOpen}
        onOpenChange={setIsPartFormOpen}
        turma={selectedTurmaForPart}
        participante={editingPart}
        onAdd={async (colabId) => {
          if (selectedTurmaForPart) {
            await addParticipante.mutateAsync({ colaboradorId: colabId, turma: selectedTurmaForPart });
          }
        }}
        onUpdate={async (data) => {
          await updateParticipante.mutateAsync(data);
        }}
      />
    </div>
  );
}
