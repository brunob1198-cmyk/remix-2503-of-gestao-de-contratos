import { useState } from "react";
import { useCotacoes, useRequisicoes, useFornecedores } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, PackageCheck, Calendar, Briefcase, AlertCircle, History } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { RequisitionTimeline } from "./RequisitionTimeline";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  recebida: { label: "Recebida", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

const PRIORIDADE_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  baixa: { label: "Baixa", variant: "secondary" },
  normal: { label: "Normal", variant: "outline" },
  alta: { label: "Alta", variant: "default" },
  urgente: { label: "Urgente", variant: "destructive" },
};

export function CotacoesTab({ filter }: { filter?: string }) {
  const { cotacoes, isLoading, create } = useCotacoes();
  const { requisicoes: allRequisicoes, updateStatus: updateRequisicaoStatus } = useRequisicoes();
  
  const requisicoes = filter === "QUOTING"
    ? allRequisicoes.filter((r: any) => r.workflow_status === "QUOTING" || r.workflow_status === "SUBMITTED")
    : allRequisicoes;
  const { fornecedores } = useFornecedores();
  const { hasActionPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<any>(null);
  const [cotacaoDetailOpen, setCotacaoDetailOpen] = useState(false);
  const [selectedCotacao, setSelectedCotacao] = useState<any>(null);
  const [reqLocked, setReqLocked] = useState(false);
  const [form, setForm] = useState({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" });
  const [cotItens, setCotItens] = useState<{ requisicao_item_id: string; preco_unitario: number; quantidade: number; observacao: string }[]>([]);

  const selectedReq = requisicoes.find((r: any) => r.id === form.requisicao_id);

  const handleReqChange = (reqId: string, lock = false) => {
    setForm(p => ({ ...p, requisicao_id: reqId }));
    setReqLocked(lock);
    const req = requisicoes.find((r: any) => r.id === reqId);
    if (req?.itens) {
      setCotItens(req.itens.map((i: any) => ({ requisicao_item_id: i.id, preco_unitario: 0, quantidade: i.quantidade, observacao: "" })));
    }
  };

  const handleSave = () => {
    create.mutate({
      ...form,
      prazo_entrega_dias: form.prazo_entrega_dias ? Number(form.prazo_entrega_dias) : null,
      itens: cotItens,
      valor_total: cotItens.reduce((sum, i) => sum + i.preco_unitario * i.quantidade, 0),
    }, { onSuccess: () => { setOpen(false); setReqLocked(false); setForm({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" }); setCotItens([]); } });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cotações</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReqLocked(false); }}>
          {hasActionPermission("pode_criar_cotacao") && (
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Cotação</Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Cotação</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Requisição *</Label>
                  <Select value={form.requisicao_id} onValueChange={(v) => handleReqChange(v)} disabled={reqLocked}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {requisicoes.filter((r: any) => r.status !== "cancelada").map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.numero} — {r.projeto?.codigo || ""} {r.projeto?.nome ? `· ${r.projeto.nome}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {reqLocked && <p className="text-xs text-muted-foreground mt-1">Requisição pré-selecionada e bloqueada para esta cotação.</p>}
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
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm(p => ({ ...p, validade: e.target.value }))} /></div>
                <div><Label>Prazo Entrega (dias)</Label><Input type="number" value={form.prazo_entrega_dias} onChange={e => setForm(p => ({ ...p, prazo_entrega_dias: e.target.value }))} /></div>
                <div><Label>Cond. Pagamento</Label><Input value={form.condicao_pagamento} onChange={e => setForm(p => ({ ...p, condicao_pagamento: e.target.value }))} /></div>
                <div><Label>Valor Frete</Label><Input type="number" step="0.01" value={form.frete} onChange={e => setForm(p => ({ ...p, frete: Number(e.target.value) }))} /></div>
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
                        <TableHead>Observação</TableHead>
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
                            <TableCell>
                              <Input 
                                placeholder="Obs." 
                                value={ci.observacao}
                                onChange={e => setCotItens(p => p.map((c, i) => i === idx ? { ...c, observacao: e.target.value } : c))} 
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-right font-semibold mt-2">Total: {fmt(cotItens.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0))}</p>
                </div>
              )}

              <div>
                <Label>Observações Gerais</Label>
                <Input value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>

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
        ) : (cotacoes.length === 0 && requisicoes.filter((r: any) => r.workflow_status === "QUOTING" || r.workflow_status === "SUBMITTED").length === 0) ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma cotação</p>
        ) : (
          <div className="space-y-6">
            {requisicoes.filter((r: any) => r.workflow_status === "QUOTING" || r.workflow_status === "SUBMITTED").length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Requisições Aguardando Cotação</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requisicoes.filter((r: any) => r.workflow_status === "QUOTING" || r.workflow_status === "SUBMITTED").map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.numero}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{r.projeto?.codigo || "—"}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">{r.projeto?.nome || ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORIDADE_MAP[r.prioridade]?.variant || "outline"}>
                            {PRIORIDADE_MAP[r.prioridade]?.label || r.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <PackageCheck className="h-3 w-3" />
                            {r.itens?.length || 0} itens
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Ver Detalhes da Requisição"
                              onClick={() => {
                                setSelectedReqForDetail(r);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {hasActionPermission("pode_criar_cotacao") && (
                              <>
                                {r.workflow_status === "SUBMITTED" && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => updateRequisicaoStatus.mutate({ id: r.id, workflow_status: "QUOTING", observacoes: "Iniciado processo de cotação com fornecedores." })}
                                  >
                                    Iniciar Cotação
                                  </Button>
                                )}
                                {r.workflow_status === "QUOTING" && (
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
                                )}
                              </>
                            )}
                          </div>
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

      {/* Detalhes da Requisição para o Comprador */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Detalhes da Requisição {selectedReqForDetail?.numero}
            </DialogTitle>
          </DialogHeader>
          {selectedReqForDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase font-semibold">Projeto</span> 
                    {selectedReqForDetail.projeto?.codigo} - {selectedReqForDetail.projeto?.nome || "—"}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase font-semibold">Data Necessidade</span> 
                    {selectedReqForDetail.data_necessidade ? parseLocalDate(selectedReqForDetail.data_necessidade).toLocaleDateString("pt-BR") : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-semibold">Prioridade</span> 
                  <Badge variant={PRIORIDADE_MAP[selectedReqForDetail.prioridade]?.variant || "outline"}>
                    {PRIORIDADE_MAP[selectedReqForDetail.prioridade]?.label || selectedReqForDetail.prioridade}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-semibold">Itens Totais</span>
                  <span className="font-medium">{selectedReqForDetail.itens?.length || 0} itens solicitados</span>
                </div>
              </div>
              
              {(selectedReqForDetail.justificativa || selectedReqForDetail.observacoes) && (
                <div className="space-y-2">
                  {selectedReqForDetail.justificativa && (
                    <div className="text-sm border p-3 rounded-lg bg-yellow-50/30">
                      <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Justificativa do Requisitante</span>
                      <p className="whitespace-pre-wrap">{selectedReqForDetail.justificativa}</p>
                    </div>
                  )}
                  {selectedReqForDetail.observacoes && (
                    <div className="text-sm border p-3 rounded-lg">
                      <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Observações Internas</span>
                      <p className="whitespace-pre-wrap">{selectedReqForDetail.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4" /> 
                  Itens para Cotação
                </h4>
                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Descrição do Item</TableHead>
                        <TableHead className="text-center w-20">Qtd</TableHead>
                        <TableHead className="w-20">Unid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReqForDetail.itens && selectedReqForDetail.itens.length > 0) ? (
                        selectedReqForDetail.itens.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.sc_item?.codigo || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {item.sc_item?.descricao || item.descricao_livre || "—"}
                              {item.sc_item?.descricao && item.descricao_livre && item.descricao_livre !== item.sc_item.descricao && (
                                <span className="block text-xs text-muted-foreground font-normal italic mt-0.5">{item.descricao_livre}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-bold">{item.quantidade}</TableCell>
                            <TableCell>{item.unidade}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground italic">Nenhum item encontrado.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="pt-4 border-t">
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Timeline da Requisição
                </h4>
                <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  <RequisitionTimeline requisicaoId={selectedReqForDetail.id} />
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                {hasActionPermission("pode_criar_cotacao") && selectedReqForDetail.workflow_status === "QUOTING" && (
                  <Button onClick={() => {
                    setDetailOpen(false);
                    handleReqChange(selectedReqForDetail.id);
                    setOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Criar Cotação Agora
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
