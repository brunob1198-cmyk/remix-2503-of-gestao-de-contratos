import { useState } from "react";
import { useSgsstPt, SgsstPt, StatusPt, TipoPt } from "@/hooks/sgsst/useSgsstPt";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, ShieldCheck, Eye, CheckCircle2, XCircle, AlertCircle, Lock, RefreshCw, PlayCircle, PauseCircle } from "lucide-react";
import { PtFormDialog } from "@/components/sgsst/PtFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

export default function SgsstPtListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pt");

  const { pts, isLoading, createPt, updatePt, removePt } = useSgsstPt();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPt, setEditingPt] = useState<SgsstPt | null>(null);

  const filteredPts = pts.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.titulo.toLowerCase().includes(term) ||
      p.atividade.toLowerCase().includes(term) ||
      (p.codigo && p.codigo.toLowerCase().includes(term)) ||
      (p.local_execucao && p.local_execucao.toLowerCase().includes(term)) ||
      (p.projeto?.nome && p.projeto.nome.toLowerCase().includes(term));

    const matchesTipo = selectedTipo === "todos" || p.tipo === selectedTipo;
    const matchesStatus = selectedStatus === "todos" || p.status === selectedStatus;

    return matchesSearch && matchesTipo && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingPt(null);
    setIsFormOpen(true);
  };

  const handleEdit = (pt: SgsstPt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPt(pt);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/pt/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingPt) {
      await updatePt.mutateAsync({ id: editingPt.id, ...data });
    } else {
      await createPt.mutateAsync(data);
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

  const getStatusBadge = (status: StatusPt) => {
    switch (status) {
      case "RASCUNHO":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1 w-fit">
            <RefreshCw className="h-3 w-3" /> RASCUNHO
          </Badge>
        );
      case "EM_ANALISE":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" /> EM ANÁLISE
          </Badge>
        );
      case "APROVADA":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> APROVADA
          </Badge>
        );
      case "EM_EXECUCAO":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 w-fit">
            <PlayCircle className="h-3 w-3" /> EM EXECUÇÃO
          </Badge>
        );
      case "SUSPENSA":
        return (
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 flex items-center gap-1 w-fit">
            <PauseCircle className="h-3 w-3" /> SUSPENSA
          </Badge>
        );
      case "REJEITADA":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> REJEITADA
          </Badge>
        );
      case "ENCERRADA":
      case "CANCELADA":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1 w-fit">
            <Lock className="h-3 w-3" /> {status}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoBadgeColor = (tipo: TipoPt) => {
    switch (tipo) {
      case "Trabalho em Altura":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Trabalho a Quente":
        return "bg-red-50 text-red-700 border-red-200";
      case "Espaço Confinado":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Trabalho com Eletricidade":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Escavação":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Içamento":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            SGSST — Permissão de Trabalho (PT)
          </h1>
          <p className="text-sm text-muted-foreground">
            Emissão, validação de checklist de segurança, controle de liberação e encerramento de serviços críticos.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Emitir Nova PT
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de PTs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pts.filter((p) => p.status === "EM_EXECUCAO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas / Liberadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {pts.filter((p) => p.status === "APROVADA").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suspensas / Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {pts.filter((p) => p.status === "SUSPENSA" || p.status === "EM_ANALISE").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, atividade, código, local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedTipo} onValueChange={setSelectedTipo}>
            <SelectTrigger className="w-[150px] text-xs">
              <SelectValue placeholder="Tipo de PT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Tipos</SelectItem>
              <SelectItem value="Trabalho a Quente">Trabalho a Quente</SelectItem>
              <SelectItem value="Trabalho em Altura">Trabalho em Altura</SelectItem>
              <SelectItem value="Espaço Confinado">Espaço Confinado</SelectItem>
              <SelectItem value="Trabalho com Eletricidade">Eletricidade</SelectItem>
              <SelectItem value="Escavação">Escavação</SelectItem>
              <SelectItem value="Içamento">Içamento</SelectItem>
              <SelectItem value="Trabalho com Produtos Químicos">Produtos Químicos</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
              <SelectItem value="APROVADA">Aprovada</SelectItem>
              <SelectItem value="EM_EXECUCAO">Em Execução</SelectItem>
              <SelectItem value="SUSPENSA">Suspensa</SelectItem>
              <SelectItem value="ENCERRADA">Encerrada</SelectItem>
              <SelectItem value="REJEITADA">Rejeitada</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título da PT / Atividade</TableHead>
                <TableHead>Tipo de Risco</TableHead>
                <TableHead>Obra / Local</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando Permissões de Trabalho...
                  </TableCell>
                </TableRow>
              ) : filteredPts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma PT emitida ou encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPts.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(p.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate">{p.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.atividade}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTipoBadgeColor(p.tipo)}>
                        {p.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{p.projeto ? `[${p.projeto.codigo}] ${p.projeto.nome}` : "—"}</div>
                      <div className="text-muted-foreground truncate">{p.local_execucao || "Local não especificado"}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatDateStr(p.data_inicio)}
                    </TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(p.id);
                          }}
                          title="Abrir Detalhes e Checklist"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && p.status !== "ENCERRADA" && p.status !== "CANCELADA" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(p, e)}
                              title="Editar PT"
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
                                  <AlertDialogTitle>Excluir PT "{p.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O checklist de segurança e o histórico de liberções desta PT serão excluídos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removePt.mutate(p.id)}>
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

      {/* Form Dialog */}
      <PtFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        pt={editingPt}
        onSave={handleSave}
        isLoading={createPt.isPending || updatePt.isPending}
      />
    </div>
  );
}
