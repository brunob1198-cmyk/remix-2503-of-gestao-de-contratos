import { useState } from "react";
import { useSgsstFuncoes, SgsstFuncao } from "@/hooks/sgsst/useSgsstFuncoes";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, Briefcase, CheckCircle2, XCircle } from "lucide-react";
import { FuncaoFormDialog } from "@/components/sgsst/FuncaoFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function SgsstFuncoesPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-funcoes");

  const { funcoes, isLoading, createFuncao, updateFuncao, removeFuncao } = useSgsstFuncoes();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFuncao, setEditingFuncao] = useState<SgsstFuncao | null>(null);

  const filteredFuncoes = funcoes.filter(
    (f) =>
      f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.cbo && f.cbo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateNew = () => {
    setEditingFuncao(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (funcao: SgsstFuncao) => {
    setEditingFuncao(funcao);
    setIsDialogOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingFuncao) {
      await updateFuncao.mutateAsync({ id: editingFuncao.id, ...data });
    } else {
      await createFuncao.mutateAsync(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            SGSST — Gestão de Funções e Cargos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre as funções ocupacionais e CBOs para mapeamento de riscos e exames do SGSST.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Função
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Funções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{funcoes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funções Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {funcoes.filter((f) => f.status === "ativo").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com CBO Informado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {funcoes.filter((f) => !!f.cbo).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da função ou CBO..."
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
                <TableHead>Nome da Função</TableHead>
                <TableHead>CBO</TableHead>
                <TableHead>Descrição / Atribuições</TableHead>
                <TableHead>Status</TableHead>
                {allowEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando funções...
                  </TableCell>
                </TableRow>
              ) : filteredFuncoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma função encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFuncoes.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.cbo || "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {f.descricao || "—"}
                    </TableCell>
                    <TableCell>
                      {f.status === "ativo" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" /> Inativo
                        </Badge>
                      )}
                    </TableCell>
                    {allowEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} title="Editar">
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
                                <AlertDialogTitle>Excluir função "{f.nome}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação removerá a função. Caso haja colaboradores vinculados, a exclusão será bloqueada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeFuncao.mutate(f.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <FuncaoFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        funcao={editingFuncao}
        onSave={handleSave}
        isLoading={createFuncao.isPending || updateFuncao.isPending}
      />
    </div>
  );
}
