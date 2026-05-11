import { useState, useMemo, memo, useCallback } from "react";
import { useAreas } from "@/hooks/useAreas";
import { Area } from "@/types/medicoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, Loader2 } from "lucide-react";
import { safeFormat } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/medicoes/ConfirmDeleteDialog";

function AreasPage() {
  const { areas, isLoading, createArea, updateArea, deleteArea } = useAreas();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const resetForm = useCallback(() => {
    setNome("");
    setDescricao("");
    setEditingId(null);
  }, []);

  const handleEdit = useCallback((area: Area) => {
    setEditingId(area.id);
    setNome(area.nome);
    setDescricao(area.descricao || "");
    setIsOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateArea.mutate({ id: editingId, nome, descricao }, {
        onSuccess: () => { setIsOpen(false); resetForm(); }
      });
    } else {
      createArea.mutate({ nome, descricao }, {
        onSuccess: () => { setIsOpen(false); resetForm(); }
      });
    }
  };

  const handleDelete = (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja excluir a área "${nome}"? Isso não será possível se houverem projetos vinculados a ela.`)) {
      deleteArea.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Áreas / Centros de Custo</h2>
          <p className="text-sm text-muted-foreground">Gerencie as áreas agrupadoras de projetos da sua empresa</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Área" : "Nova Área"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Redes, Rodovias, Predial..." required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição ou centro de custo gerencial" />
              </div>
              <Button type="submit" className="w-full" disabled={createArea.isPending || updateArea.isPending}>
                {(createArea.isPending || updateArea.isPending) ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingId ? "Salvando..." : "Criando..."}</>
                ) : (
                  editingId ? "Salvar Alterações" : "Criar Área"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Lista de Áreas ({areas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {areas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma área cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-semibold">{a.nome}</TableCell>
                    <TableCell>{a.descricao || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {safeFormat(a.created_at, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id, a.nome)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(AreasPage);
