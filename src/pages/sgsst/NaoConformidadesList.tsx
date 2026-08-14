import { useState } from "react";
import { useSgsstNaoConformidades, SgsstNaoConformidade, StatusNC, CriticidadeNC, OrigemNC } from "@/hooks/sgsst/useSgsstNaoConformidades";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, AlertOctagon, Eye, CheckCircle2, XCircle, PlayCircle, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { NcFormDialog } from "@/components/sgsst/NcFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstNaoConformidadesListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-nao-conformidades");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedCriticidade, setSelectedCriticidade] = useState<string>("todos");
  const [selectedOrigem, setSelectedOrigem] = useState<string>("todos");
  const [filterVencidasOnly, setFilterVencidasOnly] = useState(false);

  const { naoConformidades, total, isLoading, createNaoConformidade, updateNaoConformidade, removeNaoConformidade } = useSgsstNaoConformidades({
    page,
    pageSize,
    search: debouncedSearch,
    status: selectedStatus,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNc, setEditingNc] = useState<SgsstNaoConformidade | null>(null);

  const today = startOfDay(new Date());

  const isVencida = (nc: SgsstNaoConformidade) => {
    if (!nc.prazo || nc.status === "CONCLUIDA" || nc.status === "CANCELADA") return false;
    try {
      return isBefore(parseISO(nc.prazo), today);
    } catch {
      return false;
    }
  };

  const filteredNcs = naoConformidades.filter((nc) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      nc.titulo.toLowerCase().includes(term) ||
      nc.descricao.toLowerCase().includes(term) ||
      (nc.codigo && nc.codigo.toLowerCase().includes(term)) ||
      (nc.projeto?.nome && nc.projeto.nome.toLowerCase().includes(term));

    const matchesStatus = selectedStatus === "todos" || nc.status === selectedStatus;
    const matchesCriticidade = selectedCriticidade === "todos" || nc.criticidade === selectedCriticidade;
    const matchesOrigem = selectedOrigem === "todos" || nc.origem_tipo === selectedOrigem;
    const matchesVencidas = !filterVencidasOnly || isVencida(nc);

    return matchesSearch && matchesStatus && matchesCriticidade && matchesOrigem && matchesVencidas;
  });

  const handleCreateNew = () => {
    setEditingNc(null);
    setIsFormOpen(true);
  };

  const handleEdit = (nc: SgsstNaoConformidade, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNc(nc);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/nao-conformidades/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingNc) {
      await updateNaoConformidade.mutateAsync({ id: editingNc.id, ...data });
    } else {
      await createNaoConformidade.mutateAsync(data);
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

  const getCriticidadeBadge = (c: CriticidadeNC) => {
    switch (c) {
      case "BAIXA":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">BAIXA</Badge>;
      case "MEDIA":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">MÉDIA</Badge>;
      case "ALTA":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">ALTA</Badge>;
      case "CRITICA":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-bold">CRÍTICA</Badge>;
      default:
        return <Badge variant="outline">{c}</Badge>;
    }
  };

  const getStatusBadge = (s: StatusNC) => {
    switch (s) {
      case "ABERTA":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 flex items-center gap-1 w-fit">
            <AlertOctagon className="h-3 w-3 text-amber-500" /> ABERTA
          </Badge>
        );
      case "EM_ANALISE":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 w-fit">
            <Search className="h-3 w-3" /> EM ANÁLISE
          </Badge>
        );
      case "PLANO_ACAO":
        return (
          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1 w-fit">
            <PlayCircle className="h-3 w-3" /> PLANO DE AÇÃO
          </Badge>
        );
      case "EM_TRATAMENTO":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <PlayCircle className="h-3 w-3" /> EM TRATAMENTO
          </Badge>
        );
      case "AGUARDANDO_VERIFICACAO":
        return (
          <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300 flex items-center gap-1 w-fit">
            <ShieldCheck className="h-3 w-3" /> AGUARD. VERIFICAÇÃO
          </Badge>
        );
      case "CONCLUIDA":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> CONCLUÍDA
          </Badge>
        );
      case "CANCELADA":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> CANCELADA
          </Badge>
        );
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  // Stats Calculations
  const totalAbertas = naoConformidades.filter((nc) => nc.status !== "CONCLUIDA" && nc.status !== "CANCELADA").length;
  const emTratamento = naoConformidades.filter((nc) => nc.status === "EM_TRATAMENTO" || nc.status === "PLANO_ACAO").length;
  const vencidas = naoConformidades.filter(isVencida).length;
  const criticas = naoConformidades.filter((nc) => nc.criticidade === "CRITICA" && nc.status !== "CONCLUIDA" && nc.status !== "CANCELADA").length;
  const aguardandoVerificacao = naoConformidades.filter((nc) => nc.status === "AGUARDANDO_VERIFICACAO").length;
  const concluidas = naoConformidades.filter((nc) => nc.status === "CONCLUIDA").length;

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-amber-600">
            <AlertOctagon className="h-6 w-6 text-amber-600" />
            SGSST — Gestão de Não Conformidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Tratamento de desvios de segurança, verificação formal de eficácia e encerramento auditado.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar Não Conformidade
          </Button>
        )}
      </div>

      {/* 6 Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Abertas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold">{totalAbertas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em Tratamento</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{emTratamento}</div>
          </CardContent>
        </Card>
        <Card className={vencidas > 0 ? "border-red-300 bg-red-50/30" : ""}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-red-600">{vencidas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Críticas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-red-600">{criticas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Aguard. Verificação</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-indigo-600">{aguardandoVerificacao}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-emerald-600">{concluidas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, código ou obra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ABERTA">Aberta</SelectItem>
              <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
              <SelectItem value="PLANO_ACAO">Plano Ação</SelectItem>
              <SelectItem value="EM_TRATAMENTO">Em Tratamento</SelectItem>
              <SelectItem value="AGUARDANDO_VERIFICACAO">Aguard. Verificação</SelectItem>
              <SelectItem value="CONCLUIDA">Concluída</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCriticidade} onValueChange={setSelectedCriticidade}>
            <SelectTrigger className="w-[120px] text-xs">
              <SelectValue placeholder="Criticidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Criticidades</SelectItem>
              <SelectItem value="BAIXA">Baixa</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedOrigem} onValueChange={setSelectedOrigem}>
            <SelectTrigger className="w-[120px] text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Origens</SelectItem>
              <SelectItem value="INSPECAO">Inspeção</SelectItem>
              <SelectItem value="INCIDENTE">Incidente</SelectItem>
              <SelectItem value="PGR">PGR</SelectItem>
              <SelectItem value="APR">APR</SelectItem>
              <SelectItem value="PT">PT</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={filterVencidasOnly ? "destructive" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setFilterVencidasOnly(!filterVencidasOnly)}
          >
            <Clock className="h-3.5 w-3.5" /> Apenas Vencidas
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título da Não Conformidade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Criticidade</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando Não Conformidades...
                  </TableCell>
                </TableRow>
              ) : naoConformidades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma Não Conformidade encontrada nos filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                naoConformidades.map((nc) => {
                  const vencida = isVencida(nc);
                  return (
                    <TableRow
                      key={nc.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${vencida ? "bg-red-50/40" : ""}`}
                      onClick={() => handleViewDetail(nc.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {nc.codigo || "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate">{nc.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">{nc.descricao}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {nc.origem_tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{getCriticidadeBadge(nc.criticidade)}</TableCell>
                      <TableCell className="text-xs">
                        {nc.projeto ? `[${nc.projeto.codigo}] ${nc.projeto.nome}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {vencida ? (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDateStr(nc.prazo)}
                          </span>
                        ) : (
                          formatDateStr(nc.prazo)
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(nc.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(nc.id);
                            }}
                            title="Abrir Detalhes e Verificação"
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>

                          {allowEdit && nc.status !== "CONCLUIDA" && nc.status !== "CANCELADA" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleEdit(nc, e)}
                                title="Editar NC"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Não Conformidade "{nc.titulo}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O plano de ação e histórico de verificação serão excluídos permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeNaoConformidade.mutate(nc.id)}>
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
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={page + 1}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p - 1)}
            itemsPerPage={pageSize}
            onItemsPerPageChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
            totalItems={total}
          />
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <NcFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        nc={editingNc}
        onSave={handleSave}
        isLoading={createNaoConformidade.isPending || updateNaoConformidade.isPending}
      />
    </div>
  );
}
