import { useState } from "react";
import { usePedidosCompra, useFornecedores, useScItens } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  emitido: { label: "Emitido", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "default" },
  em_transito: { label: "Em Trânsito", variant: "secondary" },
  entregue_parcial: { label: "Entregue Parcial", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

interface ItemRow { descricao: string; quantidade: number; preco_unitario: number; unidade: string; sc_item_id?: string; }

export function PedidosTab() {
  const { pedidos, isLoading, create, updateStatus, remove } = usePedidosCompra();
  const { fornecedores } = useFornecedores();
  const { itens: scItens } = useScItens();
  const { hasActionPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fornecedor_id: "", data_entrega_prevista: "", condicao_pagamento: "", frete: 0, observacoes: "" });
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ descricao: "", quantidade: 1, preco_unitario: 0, unidade: "UN" }]);

  const resetForm = () => {
    setForm({ fornecedor_id: "", data_entrega_prevista: "", condicao_pagamento: "", frete: 0, observacoes: "" });
    setItemRows([{ descricao: "", quantidade: 1, preco_unitario: 0, unidade: "UN" }]);
  };

  const handleSave = () => {
    const itens = itemRows.filter(i => i.descricao).map(i => ({ ...i, valor_total: i.quantidade * i.preco_unitario }));
    create.mutate({
      ...form,
      valor_total: itens.reduce((s, i) => s + i.valor_total, 0) + (form.frete || 0),
      itens,
    }, { onSuccess: () => { setOpen(false); resetForm(); } });
  };

  const addRow = () => setItemRows(p => [...p, { descricao: "", quantidade: 1, preco_unitario: 0, unidade: "UN" }]);
  const updateRow = (idx: number, field: string, value: any) => {
    setItemRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "sc_item_id" && value) {
        const found = scItens.find((it: any) => it.id === value);
        if (found) { updated.descricao = found.descricao; updated.unidade = found.unidade; }
      }
      return updated;
    }));
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pedidos de Compra</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          {hasActionPermission("pode_criar_pedido") && (
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Pedido</Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Pedido de Compra</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fornecedor *</Label>
                  <Select value={form.fornecedor_id} onValueChange={v => setForm(p => ({ ...p, fornecedor_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {fornecedores.filter((f: any) => f.ativo).map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Entrega Prevista</Label><Input type="date" value={form.data_entrega_prevista} onChange={e => setForm(p => ({ ...p, data_entrega_prevista: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cond. Pagamento</Label><Input value={form.condicao_pagamento} onChange={e => setForm(p => ({ ...p, condicao_pagamento: e.target.value }))} /></div>
                <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={form.frete} onChange={e => setForm(p => ({ ...p, frete: Number(e.target.value) }))} /></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Itens</Label>
                  <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                {itemRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="w-32">
                      <Label className="text-xs">Item Padrão</Label>
                      <Select value={row.sc_item_id || ""} onValueChange={v => updateRow(idx, "sc_item_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Livre" /></SelectTrigger>
                        <SelectContent>
                          {scItens.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.codigo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={row.descricao} onChange={e => updateRow(idx, "descricao", e.target.value)} />
                    </div>
                    <div className="w-16"><Label className="text-xs">Qtd</Label><Input type="number" value={row.quantidade} onChange={e => updateRow(idx, "quantidade", Number(e.target.value))} /></div>
                    <div className="w-24"><Label className="text-xs">Preço Unit</Label><Input type="number" step="0.01" value={row.preco_unitario} onChange={e => updateRow(idx, "preco_unitario", Number(e.target.value))} /></div>
                    <div className="w-16"><Label className="text-xs">Unid</Label><Input value={row.unidade} onChange={e => updateRow(idx, "unidade", e.target.value)} /></div>
                    {itemRows.length > 1 && <Button variant="ghost" size="icon" onClick={() => setItemRows(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                ))}
                <p className="text-right text-sm font-medium">Subtotal: {fmt(itemRows.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0))}</p>
              </div>

              <Button onClick={handleSave} disabled={!form.fornecedor_id || create.isPending || itemRows.every(i => !i.descricao)}>
                Criar Pedido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Entrega Prevista</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p: any) => {
                const st = STATUS_MAP[p.status] || { label: p.status, variant: "outline" as const };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.numero}</TableCell>
                    <TableCell>{p.fornecedor?.razao_social || "—"}</TableCell>
                    <TableCell>{parseLocalDate(p.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{p.data_entrega_prevista ? parseLocalDate(p.data_entrega_prevista).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{fmt(p.valor_total || 0)}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.status === "emitido" && <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "confirmado" })}>Confirmar</Button>}
                        {p.status === "emitido" && <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
