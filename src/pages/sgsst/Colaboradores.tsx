import { useState } from "react";
import { useSgsstColaboradores, SgsstColaboradorDados } from "@/hooks/sgsst/useSgsstColaboradores";
import { useSgsstFuncoes } from "@/hooks/sgsst/useSgsstFuncoes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, UserCheck, CheckCircle2, AlertTriangle, XCircle, Building2 } from "lucide-react";
import { ColaboradorFormDialog } from "@/components/sgsst/ColaboradorFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";

export default function SgsstColaboradoresPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-colaboradores");

  const { colaboradores, isLoading, createColaborador, updateColaborador, removeColaborador } = useSgsstColaboradores();
  const { funcoes } = useSgsstFuncoes();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<SgsstColaboradorDados | null>(null);

  const filteredColaboradores = colaboradores.filter((c) => {
    const nomeSearch = (c.profile?.nome || c.recurso?.nome || "").toLowerCase();
    const matriculaSearch = (c.matricula || "").toLowerCase();
    const funcaoSearch = (c.funcao?.nome || "").toLowerCase();
    const term = searchTerm.toLowerCase();

    return nomeSearch.includes(term) || matriculaSearch.includes(term) || funcaoSearch.includes(term);
  });

  const handleCreateNew = () => {
    setEditingColaborador(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (colaborador: SgsstColaboradorDados) => {
    setEditingColaborador(colaborador);
    setIsDialogOpen(true);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            SGSST — Gestão de Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground">
            Vinculação de trabalhadores a funções ocupacionais, setores, vínculos e matrículas para o SGSST.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Registro SGSST
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
            <div className="text-2xl font-bold text-emerald-600">
              {colaboradores.filter((c) => c.status === "ativo").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Função SGSST</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {colaboradores.filter((c) => !!c.funcao_id).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terceirizados / PJ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {colaboradores.filter((c) => c.tipo_vinculo === "Terceirizado" || c.tipo_vinculo === "PJ").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Função SGSST</TableHead>
                <TableHead>Setor / Área</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Status</TableHead>
                {allowEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando colaboradores...
                  </TableCell>
                </TableRow>
              ) : filteredColaboradores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredColaboradores.map((c) => {
                  const nome = c.profile?.nome || c.recurso?.nome || "Trabalhador sem Nome";
                  const isProfile = !!c.profile_id;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {isProfile ? "Usuário do Sistema" : "Recurso de Canteiro"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{c.matricula || "—"}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {c.funcao?.nome || "—"}
                      </TableCell>
                      <TableCell>{c.area?.nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.tipo_vinculo}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateStr(c.data_admissao)}</TableCell>
                      <TableCell>
                        {c.status === "ativo" && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </Badge>
                        )}
                        {c.status === "afastado" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> Afastado
                          </Badge>
                        )}
                        {c.status === "desligado" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" /> Desligado
                          </Badge>
                        )}
                      </TableCell>
                      {allowEdit && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} title="Editar">
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
                                  <AlertDialogTitle>Excluir registro do colaborador?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação removerá o vínculo SGSST deste trabalhador.
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
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <ColaboradorFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        colaborador={editingColaborador}
        funcoes={funcoes}
        onSave={handleSave}
        isLoading={createColaborador.isPending || updateColaborador.isPending}
      />
    </div>
  );
}
