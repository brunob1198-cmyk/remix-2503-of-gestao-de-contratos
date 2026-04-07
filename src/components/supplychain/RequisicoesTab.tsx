import { useState } from "react";
import { useRequisicoes, useScItens } from "@/hooks/useSupplyChain";
import { useProjetos } from "@/hooks/useProjetos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  em_cotacao: { label: "Em Cotação", variant: "outline" },
  finalizada: { label: "Finalizada", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

const PRIORIDADE_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  baixa: { label: "Baixa", variant: "secondary" },
  normal: { label: "Normal", variant: "outline" },
  alta: { label: "Alta", variant: "default" },
  urgente: { label: "Urgente", variant: "destructive" },
};

interface ItemForm {
  sc_item_id: string;
  descricao_livre: string;
  quantidade: number;
  unidade: string;
}

export function RequisicoesTab() {
  const { requisicoes, isLoading, create, updateStatus, remove } = useRequisicoes();
  const { projetos } = useProjetos();
  const { itens: scItens } = useScItens();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ projeto_id: "", prioridade: "normal", data_necessidade: "", justificativa: "", observacoes: "" });
  const [itemRows, setItemRows] = useState<ItemForm[]>([{ sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }]);

  const resetForm = () => {
    setForm({ projeto_id: "", prioridade: "normal", data_necessidade: "", justificativa: "", observacoes: "" });
    setItemRows([{ sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }]);
  };

  const handleSave = () => {
    const itens = itemRows.filter(i => i.descricao_livre || i.sc_item_id);
    create.mutate({ ...form, itens }, { onSuccess: () => { setOpen(false); resetForm(); } });
  };

  const addItemRow = () => setItemRows(p => [...p, { sc_item_id: "", descricao_livre: "", quantidade: 1, unidade: "UN" }]);

  const updateItemRow = (idx: number, field: string, value: any) => {
    setItemRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "sc_item_id" && value) {
        const found = scItens.find((it: any) => it.id === value);
        if (found) {
          updated.descricao_livre = found.descricao;
          updated.unidade = found.unidade;
        }
      }
      return updated;
    }));
  };

  const removeItemRow = (idx: number) => setItemRows(p => p.filter((_, i) => i !== idx));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Requisições de Compra</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Requisição</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Requisição de Compra</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Projeto</Label>
                  <Select value={form.projeto_id} onValueChange={v => setForm(p => ({ ...p, projeto_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Data de Necessidade</Label>
                <Input type="date" value={form.data_necessidade} onChange={e => setForm(p => ({ ...p, data_necessidade: e.target.value }))} />
              </div>
              <div><Label>Justificativa</Label><Textarea value={form.justificativa} onChange={e => setForm(p => ({ ...p, justificativa: e.target.value }))} /></div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Itens</Label>
                  <Button variant="outline" size="sm" onClick={addItemRow}><Plus className="h-3 w-3 mr-1" /> Adicionar Item</Button>
                </div>
                {itemRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Item Padrão</Label>
                      <Select value={row.sc_item_id} onValueChange={v => updateItemRow(idx, "sc_item_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Livre ou selecione" /></SelectTrigger>
                        <SelectContent>
                          {scItens.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.codigo} - {it.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={row.descricao_livre} onChange={e => updateItemRow(idx, "descricao_livre", e.target.value)} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qtd</Label>
                      <Input type="number" value={row.quantidade} onChange={e => updateItemRow(idx, "quantidade", Number(e.target.value))} />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Unid</Label>
                      <Input value={row.unidade} onChange={e => updateItemRow(idx, "unidade", e.target.value)} />
                    </div>
                    {itemRows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItemRow(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} disabled={create.isPending || itemRows.every(i => !i.descricao_livre && !i.sc_item_id)}>
                Criar Requisição
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : requisicoes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma requisição</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Data Necessidade</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisicoes.map((r: any) => {
                const st = STATUS_MAP[r.status] || { label: r.status, variant: "outline" as const };
                const pr = PRIORIDADE_MAP[r.prioridade] || { label: r.prioridade, variant: "outline" as const };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.numero}</TableCell>
                    <TableCell>{r.projeto?.codigo || "—"}</TableCell>
                    <TableCell><Badge variant={pr.variant}>{pr.label}</Badge></TableCell>
                    <TableCell>{r.data_necessidade ? parseLocalDate(r.data_necessidade).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{r.itens?.length || 0}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setSelected(r); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        {r.status === "rascunho" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: "aprovada" })}>Aprovar</Button>
                        )}
                        {r.status === "rascunho" && (
                          <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Detail dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Requisição {selected?.numero}</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Projeto:</span> {selected.projeto?.nome || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={STATUS_MAP[selected.status]?.variant || "outline"}>{STATUS_MAP[selected.status]?.label || selected.status}</Badge></div>
                  <div><span className="text-muted-foreground">Prioridade:</span> {PRIORIDADE_MAP[selected.prioridade]?.label || selected.prioridade}</div>
                  <div><span className="text-muted-foreground">Data:</span> {selected.data_necessidade ? parseLocalDate(selected.data_necessidade).toLocaleDateString("pt-BR") : "—"}</div>
                </div>
                {selected.justificativa && <p className="text-sm"><span className="text-muted-foreground">Justificativa:</span> {selected.justificativa}</p>}
                <div>
                  <h4 className="font-medium mb-1">Itens ({selected.itens?.length || 0})</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Unid</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(selected.itens || []).map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.sc_item?.descricao || item.descricao_livre || "—"}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>{item.unidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
