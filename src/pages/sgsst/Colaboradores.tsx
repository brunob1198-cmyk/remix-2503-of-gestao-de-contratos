import { useState } from "react";
import { useSgsstColaboradores, SgsstColaboradorDados } from "@/hooks/sgsst/useSgsstColaboradores";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, UserCheck, CheckCircle2, AlertTriangle, XCircle, GraduationCap, Eye, FileCheck } from "lucide-react";
import { ColaboradorFormDialog } from "@/components/sgsst/ColaboradorFormDialog";
import { ColaboradorDetailDialog } from "@/components/sgsst/ColaboradorDetailDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { SgsstSegurancaHeaderNav } from "@/components/sgsst/SgsstSegurancaHeaderNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

export default function SgsstColaboradoresPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-colaboradores");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  const { colaboradores, total, isLoading, createColaborador, updateColaborador, removeColaborador } = useSgsstColaboradores({
    page,
    pageSize,
    search: debouncedSearch,
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<SgsstColaboradorDados | null>(null);
  const [selectedColaboradorForDetail, setSelectedColaboradorForDetail] = useState<SgsstColaboradorDados | null>(null);

  const handleCreateNew = () => {
    setEditingColaborador(null);
    setIsFormOpen(true);
  };

  const handleEdit = (colaborador: SgsstColaboradorDados, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColaborador(colaborador);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (colaborador: SgsstColaboradorDados) => {
    setSelectedColaboradorForDetail(colaborador);
    setIsDetailOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingColaborador) {
      await updateColaborador.mutateAsync({ id: editingColaborador.id, ...data });
    } else {
      await createColaborador.mutateAsync(data);
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

  // Metrics
  const trabalhadoresAtivos = colaboradores.filter((c) => c.status === "ativo").length;
  const comFuncao = colaboradores.filter((c) => !!c.funcao_id).length;
  const comTreinamento = colaboradores.filter((c) => (c.treinamentos?.length || 0) > 0).length;

  return (
    <div className="space-y-6">
      <SgsstSegurancaHeaderNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            SGSST — Gestão de Colaboradores & Dossiê SST
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro completo de colaboradores, ficha de EPIs, NRs e upload de certificados de treinamento no R2.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Colaborador
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cadastrado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{colaboradores.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trabalhadores Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{trabalhadoresAtivos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Função SGSST</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{comFuncao}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com NRs / Treinamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{comTreinamento}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, matrícula ou função..."
                className="pl-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Função SGSST</TableHead>
                <TableHead>CPF / Matrícula</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>EPI Sizes</TableHead>
                <TableHead>NRs / Treinamentos</TableHead>
                <TableHead>Status</TableHead>
                {allowEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    Carregando quadro de colaboradores...
                  </TableCell>
                </TableRow>
              ) : colaboradores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    Nenhum colaborador cadastrado ou encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                colaboradores.map((c) => {
                  const nomeColab = c.nome || c.profile?.nome || c.recurso?.nome || "Sem Nome";
                  const fotoColab = c.foto_url || c.profile?.avatar_url || "";
                  const totalNrs = c.treinamentos?.length || 0;

                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleOpenDetail(c)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={fotoColab ? resolveFileUrl(fotoColab) : ""} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {nomeColab.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-xs text-foreground">{nomeColab}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.telefone ? c.telefone : c.email ? c.email : "Sem contato"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-primary">
                        {c.funcao?.nome || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{c.cpf || "—"}</div>
                        {c.matricula && <div className="text-[11px] font-mono text-muted-foreground">Mat: {c.matricula}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {c.tipo_vinculo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.tamanho_calcado || c.tamanho_camisa || c.tamanho_calca ? (
                          <span>
                            Bota: <strong>{c.tamanho_calcado || "—"}</strong> | Cam: <strong>{c.tamanho_camisa || "—"}</strong>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1 text-xs">
                          <GraduationCap className="h-3 w-3" /> {totalNrs} NRs / Cursos
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === "ativo" && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit text-xs">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </Badge>
                        )}
                        {c.status === "afastado" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit text-xs">
                            <AlertTriangle className="h-3 w-3" /> Afastado
                          </Badge>
                        )}
                        {c.status === "desligado" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit text-xs">
                            <XCircle className="h-3 w-3" /> Desligado
                          </Badge>
                        )}
                      </TableCell>
                      {allowEdit && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(c)}
                              className="text-xs gap-1 text-primary"
                              title="Ver Dossiê Completo & NRs"
                            >
                              <Eye className="h-3.5 w-3.5" /> Dossiê
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleEdit(c, e)}
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir cadastro do colaborador?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação removerá o registro completo deste trabalhador no SGSST.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeColaborador.mutate(c.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
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

      {/* Form Dialog for Creating / Editing Colaborador */}
      <ColaboradorFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        colaboradorToEdit={editingColaborador}
        onSave={handleSave}
      />

      {/* Detail Dialog for Worker Dossier & NRs / Certificates Upload */}
      <ColaboradorDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        colaborador={selectedColaboradorForDetail}
      />
    </div>
  );
}
