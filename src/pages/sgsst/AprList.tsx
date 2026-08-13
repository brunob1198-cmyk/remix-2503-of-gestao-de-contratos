import { useState } from "react";
import { useSgsstApr, SgsstApr, StatusApr } from "@/hooks/sgsst/useSgsstApr";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, ClipboardList, Eye, CheckCircle2, XCircle, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { AprFormDialog } from "@/components/sgsst/AprFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

export default function SgsstAprListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-apr");

  const { aprs, isLoading, createApr, updateApr, removeApr } = useSgsstApr();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingApr, setEditingApr] = useState<SgsstApr | null>(null);

  const filteredAprs = aprs.filter((a) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      a.titulo.toLowerCase().includes(term) ||
      a.atividade.toLowerCase().includes(term) ||
      (a.codigo && a.codigo.toLowerCase().includes(term)) ||
      (a.projeto?.nome && a.projeto.nome.toLowerCase().includes(term));

    const matchesStatus = selectedStatus === "todos" || a.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingApr(null);
    setIsFormOpen(true);
  };

  const handleEdit = (apr: SgsstApr, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingApr(apr);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/apr/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingApr) {
      await updateApr.mutateAsync({ id: editingApr.id, ...data });
    } else {
      await createApr.mutateAsync(data);
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

  const getStatusBadge = (status: StatusApr) => {
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
      case "REJEITADA":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> REJEITADA
          </Badge>
        );
      case "CANCELADA":
      case "ENCERRADA":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1 w-fit">
            <Lock className="h-3 w-3" /> {status}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            SGSST — Análise Preliminar de Riscos (APR)
          </h1>
          <p className="text-sm text-muted-foreground">
            Avaliação prévia de segurança, identificação de perigos por etapa e plano de ação de campo.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova APR
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de APRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aprs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">APRs Aprovadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {aprs.filter((a) => a.status === "APROVADA").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Análise / Rascunho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {aprs.filter((a) => a.status === "EM_ANALISE" || a.status === "RASCUNHO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejeitadas / Encerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {aprs.filter((a) => a.status === "REJEITADA" || a.status === "ENCERRADA" || a.status === "CANCELADA").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, atividade, código ou obra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
              <SelectItem value="APROVADA">Aprovada</SelectItem>
              <SelectItem value="REJEITADA">Rejeitada</SelectItem>
              <SelectItem value="CANCELADA">Cancelada</SelectItem>
              <SelectItem value="ENCERRADA">Encerrada</SelectItem>
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
                <TableHead>Título / Atividade</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Setor / Área</TableHead>
                <TableHead>Elaboração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando Análises Preliminares de Riscos...
                  </TableCell>
                </TableRow>
              ) : filteredAprs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma APR cadastrada ou encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAprs.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(a.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {a.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate">{a.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.atividade}</div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.projeto ? `[${a.projeto.codigo}] ${a.projeto.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.area ? a.area.nome : "Geral"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateStr(a.data)}
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(a.id);
                          }}
                          title="Abrir Detalhes e Etapas"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && (a.status === "RASCUNHO" || a.status === "EM_ANALISE" || a.status === "REJEITADA") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(a, e)}
                              title="Editar APR"
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
                                  <AlertDialogTitle>Excluir APR "{a.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todas as etapas, riscos, medidas de controle e participantes desta APR serão removidos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeApr.mutate(a.id)}>
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
      <AprFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        apr={editingApr}
        onSave={handleSave}
        isLoading={createApr.isPending || updateApr.isPending}
      />
    </div>
  );
}
