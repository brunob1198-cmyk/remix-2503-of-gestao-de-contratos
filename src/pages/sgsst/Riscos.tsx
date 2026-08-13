import { useState } from "react";
import { useSgsstRiscos, SgsstRisco, CategoriaRisco } from "@/hooks/sgsst/useSgsstRiscos";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit2, Trash2, AlertTriangle, Eye, CheckCircle2, XCircle, Filter } from "lucide-react";
import { RiscosFormDialog } from "@/components/sgsst/RiscosFormDialog";
import { RiscosDetailDialog } from "@/components/sgsst/RiscosDetailDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function SgsstRiscosPage() {
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("sgsst-riscos");

  const { riscos, isLoading, createRisco, updateRisco, removeRisco } = useSgsstRiscos();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<SgsstRisco | null>(null);
  const [viewingRisco, setViewingRisco] = useState<SgsstRisco | null>(null);

  const filteredRiscos = riscos.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      r.nome.toLowerCase().includes(term) ||
      (r.codigo && r.codigo.toLowerCase().includes(term)) ||
      (r.agente && r.agente.toLowerCase().includes(term)) ||
      (r.fonte_geradora && r.fonte_geradora.toLowerCase().includes(term));

    const matchesCategoria = selectedCategoria === "todos" || r.categoria === selectedCategoria;
    const matchesStatus = selectedStatus === "todos" || r.status === selectedStatus;

    return matchesSearch && matchesCategoria && matchesStatus;
  });

  const handleCreateNew = () => {
    setEditingRisco(null);
    setIsFormOpen(true);
  };

  const handleEdit = (risco: SgsstRisco) => {
    setEditingRisco(risco);
    setIsFormOpen(true);
  };

  const handleView = (risco: SgsstRisco) => {
    setViewingRisco(risco);
    setIsDetailOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingRisco) {
      await updateRisco.mutateAsync({ id: editingRisco.id, ...data });
    } else {
      await createRisco.mutateAsync(data);
    }
  };

  const getCategoriaBadgeColor = (cat: CategoriaRisco) => {
    switch (cat) {
      case "Físico":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Químico":
        return "bg-red-100 text-red-800 border-red-300";
      case "Biológico":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Ergonômico":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Acidente":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            SGSST — Catálogo de Perigos e Riscos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro centralizado de riscos ocupacionais para utilização no PGR, APR, Inspeções e Incidentes.
          </p>
        </div>
        {allowEdit && (
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Risco
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Riscos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riscos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Riscos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {riscos.filter((r) => r.status === "ativo").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Físicos / Químicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {riscos.filter((r) => r.categoria === "Físico" || r.categoria === "Químico").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ergonômicos / Acidentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {riscos.filter((r) => r.categoria === "Ergonômico" || r.categoria === "Acidente").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, agente ou fonte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros:</span>
          </div>
          <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Categorias</SelectItem>
              <SelectItem value="Físico">Físico</SelectItem>
              <SelectItem value="Químico">Químico</SelectItem>
              <SelectItem value="Biológico">Biológico</SelectItem>
              <SelectItem value="Ergonômico">Ergonômico</SelectItem>
              <SelectItem value="Acidente">Acidente</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
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
                <TableHead>Nome do Risco / Perigo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Agente Nocivo</TableHead>
                <TableHead>Fonte Geradora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando catálogo de riscos...
                  </TableCell>
                </TableRow>
              ) : filteredRiscos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum risco cadastrado ou encontrado nos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRiscos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.codigo || "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {r.nome}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoriaBadgeColor(r.categoria)}>
                        {r.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {r.agente || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {r.fonte_geradora || "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === "ativo" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" /> Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(r)} title="Visualizar Detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>

                        {allowEdit && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} title="Editar">
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
                                  <AlertDialogTitle>Excluir risco "{r.nome}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação removerá o risco do catálogo da empresa.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeRisco.mutate(r.id)}>
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
      <RiscosFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        risco={editingRisco}
        onSave={handleSave}
        isLoading={createRisco.isPending || updateRisco.isPending}
      />

      {/* Detail Dialog */}
      <RiscosDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        risco={viewingRisco}
      />
    </div>
  );
}
