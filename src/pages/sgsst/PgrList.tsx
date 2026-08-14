import { useState } from "react";
import { useSgsstPgr, SgsstPgr, StatusPgr } from "@/hooks/sgsst/useSgsstPgr";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, FileCheck, Eye, CheckCircle2, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { PgrFormDialog } from "@/components/sgsst/PgrFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";

export default function SgsstPgrListPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-pgr");

  const { pgrs, isLoading, createPgr, updatePgr, updateStatusPgr, removePgr } = useSgsstPgr();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPgr, setEditingPgr] = useState<SgsstPgr | null>(null);

  const filteredPgrs = pgrs.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.titulo.toLowerCase().includes(term) ||
      (p.codigo && p.codigo.toLowerCase().includes(term)) ||
      (p.projeto?.nome && p.projeto.nome.toLowerCase().includes(term));

    const matchesStatus = selectedStatus === "todos" || p.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingPgr(null);
    setIsFormOpen(true);
  };

  const handleEdit = (pgr: SgsstPgr, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPgr(pgr);
    setIsFormOpen(true);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/medicoes/sgsst/pgr/${id}`);
  };

  const handleSave = async (data: any) => {
    if (editingPgr) {
      await updatePgr.mutateAsync({ id: editingPgr.id, ...data });
    } else {
      await createPgr.mutateAsync(data);
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

  const getStatusBadge = (status: StatusPgr) => {
    switch (status) {
      case "RASCUNHO":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1 w-fit">
            <RefreshCw className="h-3 w-3" /> RASCUNHO
          </Badge>
        );
      case "ATIVO":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" /> ATIVO
          </Badge>
        );
      case "EM_REVISAO":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" /> EM REVISÃO
          </Badge>
        );
      case "ENCERRADO":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 flex items-center gap-1 w-fit">
            <Lock className="h-3 w-3" /> ENCERRADO
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            SGSST — Programa de Gerenciamento de Riscos (PGR)
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão dos documentos do PGR e Inventários de Riscos Ocupacionais das Obras.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Documento PGR
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de PGRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pgrs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">PGRs Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {pgrs.filter((p) => p.status === "ATIVO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Revisão / Rascunho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {pgrs.filter((p) => p.status === "EM_REVISAO" || p.status === "RASCUNHO").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Encerrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {pgrs.filter((p) => p.status === "ENCERRADO").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, título ou obra..."
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
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="EM_REVISAO">Em Revisão</SelectItem>
              <SelectItem value="ENCERRADO">Encerrado</SelectItem>
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
                <TableHead>Título do PGR</TableHead>
                <TableHead>Obra / Projeto</TableHead>
                <TableHead>Canteiro / Site</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando PGRs...
                  </TableCell>
                </TableRow>
              ) : filteredPgrs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum PGR cadastrado ou encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPgrs.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetail(p.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {p.titulo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.projeto ? `[${p.projeto.codigo}] ${p.projeto.nome}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.site ? p.site.nome : "Geral"}
                    </TableCell>
                    <TableCell className="text-xs">
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
                          title="Abrir Inventário e Detalhes"
                        >
                          <Eye className="h-4 w-4 text-primary" />
                        </Button>

                        {allowEdit && p.status !== "ENCERRADO" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(p, e)}
                              title="Editar Documento"
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
                                  <AlertDialogTitle>Excluir PGR "{p.titulo}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todos os itens do inventário de riscos e medidas de controle deste PGR serão removidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removePgr.mutate(p.id)}>
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
      <PgrFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        pgr={editingPgr}
        onSave={handleSave}
        isLoading={createPgr.isPending || updatePgr.isPending}
      />
    </div>
  );
}
