import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, Check, Pencil, Trash2, X } from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ItemDisponivel {
  id: string;
  item_lpu_id: string;
  nome: string;
  valor_unitario: number;
}

interface ProducaoSectionProps {
  producoes: any[];
  itensDisponiveis: ItemDisponivel[];
  diarioId?: string;
  onAdd: (itemId: string, qtd: string, files: File[]) => Promise<void> | void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, qtd: string) => Promise<void> | void;
  onUploadFoto: (e: React.ChangeEvent<HTMLInputElement>, classificacao: string, diarioProducaoId?: string) => void;
  fotos: any[];
}

function ProducaoSection({
  producoes,
  itensDisponiveis,
  onAdd,
  onRemove,
  onUpdate,
  onUploadFoto,
}: ProducaoSectionProps) {
  const [prodItemId, setProdItemId] = useState("");
  const [prodQtd, setProdQtd] = useState("");
  const [pendingProdFiles, setPendingProdFiles] = useState<File[]>([]);
  const [editingProducaoId, setEditingProducaoId] = useState<string | null>(null);
  const [editProducaoQtd, setEditProducaoQtd] = useState("");

  const handleAdd = async () => {
    await onAdd(prodItemId, prodQtd, pendingProdFiles);
    setProdItemId("");
    setProdQtd("");
    setPendingProdFiles([]);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Produção</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={prodItemId} onValueChange={setProdItemId}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione item" /></SelectTrigger>
            <SelectContent>
              {itensDisponiveis.map(i => <SelectItem key={i.id} value={i.item_lpu_id || i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" value={prodQtd} onChange={e => setProdQtd(e.target.value)} placeholder="Qtd" className="w-24" />
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {producoes.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.item_lpu?.codigo ? `${p.item_lpu.codigo} — ` : ""}{p.item_lpu?.descricao}
                </TableCell>
                <TableCell className="text-right">
                  {editingProducaoId === p.id ? (
                    <Input
                      type="number"
                      value={editProducaoQtd}
                      onChange={e => setEditProducaoQtd(e.target.value)}
                      className="w-20 ml-auto h-8"
                    />
                  ) : (
                    p.quantidade
                  )}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(p.valor_total)}</TableCell>
                <TableCell>
                  <input type="file" multiple accept="image/*" className="hidden" id={`prod-foto-${p.id}`} onChange={e => e.target.files && onUploadFoto(e, "execucao", p.id)} />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById(`prod-foto-${p.id}`)?.click()}>
                    <Camera className="h-4 w-4 mr-1" /> Foto
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {editingProducaoId === p.id ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={async () => { await onUpdate(p.id, editProducaoQtd); setEditingProducaoId(null); }} className="h-8 w-8 text-green-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingProducaoId(null)} className="h-8 w-8 text-red-600">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProducaoId(p.id);
                            setEditProducaoQtd(String(p.quantidade));
                          }}
                          className="h-8 w-8"
                          title="Editar quantidade"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onRemove(p.id)} className="h-8 w-8 text-destructive" title="Excluir item">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default React.memo(ProducaoSection);
