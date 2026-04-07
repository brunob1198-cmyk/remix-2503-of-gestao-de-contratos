import { useState } from "react";
import { useScItens } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

export function ItensTab() {
  const { itens, isLoading, create, update, remove } = useScItens();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ codigo: "", descricao: "", unidade: "UN", categoria: "", especificacao: "" });

  const resetForm = () => { setForm({ codigo: "", descricao: "", unidade: "UN", categoria: "", especificacao: "" }); setEditing(null); };

  const handleSave = () => {
    if (editing) {
      update.mutate({ id: editing.id, ...form }, { onSuccess: () => { setOpen(false); resetForm(); } });
    } else {
      create.mutate(form, { onSuccess: () => { setOpen(false); resetForm(); } });
    }
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    setForm({ codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, categoria: item.categoria || "", especificacao: item.especificacao || "" });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Itens de Suprimentos</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Item</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} /></div>
                <div><Label>Unidade *</Label><Input value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} /></div>
              </div>
              <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
              <div><Label>Especificação</Label><Input value={form.especificacao} onChange={e => setForm(p => ({ ...p, especificacao: e.target.value }))} /></div>
              <Button onClick={handleSave} disabled={!form.codigo || !form.descricao}>
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum item cadastrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.codigo}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell>{item.categoria ? <Badge variant="outline">{item.categoria}</Badge> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
