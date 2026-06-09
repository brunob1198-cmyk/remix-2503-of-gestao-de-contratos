import { useState } from "react";
import { useCotacoes, useRequisicoes, useFornecedores } from "@/hooks/useSupplyChain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  recebida: { label: "Recebida", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

export function CotacoesTab() {
  const { cotacoes, isLoading, create } = useCotacoes();
  const { requisicoes } = useRequisicoes();
  const { fornecedores } = useFornecedores();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" });
  const [cotItens, setCotItens] = useState<{ requisicao_item_id: string; preco_unitario: number; quantidade: number }[]>([]);

  const selectedReq = requisicoes.find((r: any) => r.id === form.requisicao_id);

  const handleReqChange = (reqId: string) => {
    setForm(p => ({ ...p, requisicao_id: reqId }));
    const req = requisicoes.find((r: any) => r.id === reqId);
    if (req?.itens) {
      setCotItens(req.itens.map((i: any) => ({ requisicao_item_id: i.id, preco_unitario: 0, quantidade: i.quantidade })));
    }
  };

  const handleSave = () => {
    create.mutate({
      ...form,
      prazo_entrega_dias: form.prazo_entrega_dias ? Number(form.prazo_entrega_dias) : null,
      itens: cotItens,
      valor_total: cotItens.reduce((sum, i) => sum + i.preco_unitario * i.quantidade, 0),
    }, { onSuccess: () => { setOpen(false); setForm({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" }); setCotItens([]); } });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cotações</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Cotação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Cotação</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Requisição *</Label>
                  <Select value={form.requisicao_id} onValueChange={handleReqChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {requisicoes.filter((r: any) => r.status !== "cancelada").map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.numero} - {r.projeto?.codigo || ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm(p => ({ ...p, validade: e.target.value }))} /></div>
                <div><Label>Prazo Entrega (dias)</Label><Input type="number" value={form.prazo_entrega_dias} onChange={e => setForm(p => ({ ...p, prazo_entrega_dias: e.target.value }))} /></div>
                <div><Label>Cond. Pagamento</Label><Input value={form.condicao_pagamento} onChange={e => setForm(p => ({ ...p, condicao_pagamento: e.target.value }))} /></div>
              </div>

              {cotItens.length > 0 && (
                <div>
                  <Label className="text-base font-semibold">Preços dos Itens</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cotItens.map((ci, idx) => {
                        const reqItem = selectedReq?.itens?.find((i: any) => i.id === ci.requisicao_item_id);
                        return (
                          <TableRow key={idx}>
                            <TableCell>{reqItem?.sc_item?.descricao || reqItem?.descricao_livre || "Item"}</TableCell>
                            <TableCell>{ci.quantidade}</TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" className="w-28" value={ci.preco_unitario}
                                onChange={e => setCotItens(p => p.map((c, i) => i === idx ? { ...c, preco_unitario: Number(e.target.value) } : c))} />
                            </TableCell>
                            <TableCell>{fmt(ci.preco_unitario * ci.quantidade)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-right font-semibold mt-2">Total: {fmt(cotItens.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0))}</p>
                </div>
              )}

              <Button onClick={handleSave} disabled={!form.requisicao_id || !form.fornecedor_id || create.isPending}>
                Registrar Cotação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : (cotacoes.length === 0 && requisicoes.filter((r: any) => r.workflow_status === "QUOTING").length === 0) ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma cotação</p>
        ) : (
          <div className="space-y-6">
            {requisicoes.filter((r: any) => r.workflow_status === "QUOTING").length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Requisições Aguardando Cotação</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requisicoes.filter((r: any) => r.workflow_status === "QUOTING").map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.numero}</TableCell>
                        <TableCell>{r.projeto?.codigo || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.prioridade === "urgente" ? "destructive" : "outline"}>
                            {r.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              handleReqChange(r.id);
                              setOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Criar Cotação
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {cotacoes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cotações Registradas</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Prazo (dias)</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotacoes.map((c: any) => {
                      const st = STATUS_MAP[c.status] || { label: c.status, variant: "outline" as const };
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono">{c.numero}</TableCell>
                          <TableCell>{c.fornecedor?.razao_social || "—"}</TableCell>
                          <TableCell>{c.prazo_entrega_dias || "—"}</TableCell>
                          <TableCell>{fmt(c.valor_total || 0)}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
