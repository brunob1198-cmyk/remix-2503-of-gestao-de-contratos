import { useState, useEffect, useMemo } from "react";
import { useCotacoesMestreDetalhe, useFornecedores, useCotacoes } from "@/hooks/useSupplyChain";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, PackageCheck, Calendar, Briefcase, AlertCircle, History, ChevronRight, Search } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { diasCotacaoAtrasada, isCotacaoAtrasada } from "@/lib/cotacaoAtraso";
import { RequisitionTimeline } from "./RequisitionTimeline";

// WORKFLOW_STATUS in the DB
const WORKFLOW_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning" }> = {
  SUBMITTED: { label: "Aguardando cotação", variant: "warning" },
  PENDING_APPROVAL: { label: "Aguardando cotação", variant: "warning" },
  QUOTING: { label: "Em cotação", variant: "outline" }, // Azulzinho ou primário, usando outline para diferenciar
  APPROVED: { label: "Aprovada", variant: "default" },
};

const COTACAO_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  recebida: { label: "Recebida", variant: "outline" },
  aprovada: { label: "Vencedora", variant: "default" },
  rejeitada: { label: "Perdida", variant: "destructive" },
};

const PRIORIDADE_MAP: Record<string, { label: string; bg: string; text: string }> = {
  baixa: { label: "Baixa", bg: "bg-slate-100", text: "text-slate-700" },
  normal: { label: "Média", bg: "bg-orange-100", text: "text-orange-700" },
  alta: { label: "Alta", bg: "bg-red-100", text: "text-red-700" },
  urgente: { label: "Urgente", bg: "bg-red-200", text: "text-red-800" },
};

export function CotacoesTab({ filter, onNavigate }: { filter?: string; onNavigate?: (t: string, f?: string) => void }) {
  const { data: requisicoesMestreDetalhe = [], isLoading } = useCotacoesMestreDetalhe();
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const debouncedFornecedorSearch = useDebounce(fornecedorSearch, 250);
  const { fornecedores } = useFornecedores({ search: debouncedFornecedorSearch });
  const { create: createCotacao } = useCotacoes(); // Using only the mutation part for creation
  const { hasActionPermission } = usePermissions();

  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
  
  // Modals
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReqForDetail, setSelectedReqForDetail] = useState<any>(null);
  const [cotacaoDetailOpen, setCotacaoDetailOpen] = useState(false);
  const [selectedCotacao, setSelectedCotacao] = useState<any>(null);
  
  // Cotação Form
  const [reqLocked, setReqLocked] = useState(false);
  const [form, setForm] = useState({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" });
  const [cotItens, setCotItens] = useState<{ requisicao_item_id: string; preco_unitario: number; quantidade: number; observacao: string }[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todas");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Auto-expand RCs em QUOTING com cotações
  useEffect(() => {
    if (requisicoesMestreDetalhe.length > 0) {
      const toExpand = new Set(expandedReqs);
      requisicoesMestreDetalhe.forEach((r: any) => {
        if (r.workflow_status === "QUOTING" && (r.cotacoes?.length || 0) >= 1) {
          toExpand.add(r.id);
        }
      });
      if (toExpand.size > expandedReqs.size) {
        setExpandedReqs(toExpand);
      }
    }
  }, [requisicoesMestreDetalhe]);

  // Filtering
  const filteredReqs = useMemo(() => {
    let filtered = requisicoesMestreDetalhe;
    
    // External filter support (e.g., from Dashboard)
    if (filter === "QUOTING") {
      filtered = filtered.filter((r: any) => r.workflow_status === "QUOTING" || r.workflow_status === "SUBMITTED");
    } else if (filter === "prioridade_alta") {
      filtered = filtered.filter((r: any) => 
        (r.prioridade === "alta" || r.prioridade === "urgente") &&
        (!r.cotacoes || r.cotacoes.length === 0)
      );
    } else if (filter === "cotacoes_atrasadas") {
      filtered = filtered.filter((r: any) =>
        r.cotacoes?.some((c: any) => isCotacaoAtrasada(c))
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((r: any) => 
        r.numero?.toLowerCase().includes(term) || 
        r.projeto?.nome?.toLowerCase().includes(term) ||
        r.projeto?.codigo?.toLowerCase().includes(term)
      );
    }
    
    if (prioridadeFilter !== "todas") {
      filtered = filtered.filter((r: any) => {
        if (prioridadeFilter === "normal") return r.prioridade === "normal" || !r.prioridade;
        return r.prioridade === prioridadeFilter;
      });
    }

    if (statusFilter !== "todas") {
      filtered = filtered.filter((r: any) => {
        if (statusFilter === "aguardando") return r.workflow_status === "SUBMITTED" || r.workflow_status === "PENDING_APPROVAL";
        if (statusFilter === "cotacao") return r.workflow_status === "QUOTING";
        if (statusFilter === "aprovada") return r.workflow_status === "APPROVED";
        return true;
      });
    }

    return filtered;
  }, [requisicoesMestreDetalhe, filter, searchTerm, prioridadeFilter, statusFilter]);

  // Pagination Logic
  const totalItems = filteredReqs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedReqs = filteredReqs.slice((page - 1) * pageSize, page * pageSize);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedReqs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedReqs(newExpanded);
  };

  const handleReqChange = (reqId: string, lock = false) => {
    setForm(p => ({ ...p, requisicao_id: reqId }));
    setReqLocked(lock);
    const req = requisicoesMestreDetalhe.find((r: any) => r.id === reqId);
    if (req?.itens) {
      setCotItens(req.itens.map((i: any) => ({ requisicao_item_id: i.id, preco_unitario: 0, quantidade: i.quantidade || 1, observacao: "" })));
    }
  };

  const openNewCotacaoModal = (reqId?: string) => {
    if (reqId) {
      handleReqChange(reqId, true);
    } else {
      setForm({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" });
      setReqLocked(false);
      setCotItens([]);
    }
    setOpen(true);
  };

  const handleSave = () => {
    createCotacao.mutate({
      ...form,
      prazo_entrega_dias: form.prazo_entrega_dias ? Number(form.prazo_entrega_dias) : null,
      itens: cotItens,
      valor_total: cotItens.reduce((sum, i) => sum + i.preco_unitario * i.quantidade, 0),
    }, { 
      onSuccess: () => { 
        setOpen(false); 
        setReqLocked(false); 
        setForm({ requisicao_id: "", fornecedor_id: "", validade: "", prazo_entrega_dias: "", condicao_pagamento: "", frete: 0, desconto_percentual: 0, observacoes: "" }); 
        setCotItens([]); 
      } 
    });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const selectedReq = requisicoesMestreDetalhe.find((r: any) => r.id === form.requisicao_id);

  return (
    <Card className="flex flex-col h-full border-none shadow-none md:border-solid md:shadow-sm">
      <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pb-4">
        <CardTitle className="text-xl">Gestão de Cotações</CardTitle>
        {hasActionPermission("pode_criar_cotacao") && (
          <Button size="sm" onClick={() => openNewCotacaoModal()}><Plus className="h-4 w-4 mr-1" /> Nova Cotação</Button>
        )}
      </CardHeader>
      
      <div className="px-6 flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar RC ou projeto..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted-foreground font-medium mr-1">Prioridade:</span>
          {["todas", "alta", "normal", "baixa"].map(p => (
            <Badge 
              key={p} 
              variant={prioridadeFilter === p ? "default" : "outline"} 
              className={`cursor-pointer ${prioridadeFilter !== p ? "hover:bg-muted" : ""}`}
              onClick={() => { setPrioridadeFilter(p); setPage(1); }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2 items-center flex-wrap md:ml-auto">
          <span className="text-sm text-muted-foreground font-medium mr-1">Estágio:</span>
          {[
            { id: "todas", label: "Todas" },
            { id: "aguardando", label: "Aguardando" },
            { id: "cotacao", label: "Em cotação" },
            { id: "aprovada", label: "Aprovada" }
          ].map(s => (
            <Badge 
              key={s.id} 
              variant={statusFilter === s.id ? "default" : "outline"} 
              className={`cursor-pointer ${statusFilter !== s.id ? "hover:bg-muted" : ""}`}
              onClick={() => { setStatusFilter(s.id); setPage(1); }}
            >
              {s.label}
            </Badge>
          ))}
        </div>
      </div>

      <CardContent className="flex-1 pb-0">
        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Carregando cotações...</p>
        ) : paginatedReqs.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Nenhuma requisição encontrada com os filtros atuais.</p>
        ) : (
          <div className="space-y-4">
            {paginatedReqs.map((req: any) => {
              const isExpanded = expandedReqs.has(req.id);
              const prioridade = PRIORIDADE_MAP[req.prioridade?.toLowerCase() || "normal"] || PRIORIDADE_MAP["normal"];
              const status = WORKFLOW_STATUS_MAP[req.workflow_status] || { label: req.workflow_status, variant: "outline" };
              const cotacoesCount = req.cotacoes?.length || 0;
              const hasAprovada = req.cotacoes?.some((c: any) => c.status === "aprovada");

              return (
                <div key={req.id} className={`border rounded-lg overflow-hidden transition-all duration-200 ${isExpanded ? "ring-1 ring-primary/20 shadow-sm" : "hover:border-primary/30 hover:bg-muted/30"}`}>
                  {/* Master Header */}
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer bg-background"
                    onClick={() => toggleExpand(req.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                      
                      <div className="w-24 shrink-0">
                        <span className="font-mono font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedReqForDetail(req); setDetailOpen(true); }}>
                          {req.numero}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-semibold truncate text-foreground">{req.projeto?.nome || "Sem projeto"}</p>
                        <p className="text-xs text-muted-foreground truncate">{req.projeto?.codigo || "N/A"}</p>
                      </div>
                      
                      <div className="hidden md:flex shrink-0 items-center gap-3 mr-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${prioridade.bg} ${prioridade.text}`}>
                          {prioridade.label}
                        </span>
                        
                        <Badge variant={status.variant === "warning" ? "secondary" : status.variant as any} className={status.variant === "warning" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : status.variant === "outline" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end mt-3 sm:mt-0 gap-4 sm:min-w-[120px]">
                      <span className="text-xs text-muted-foreground font-medium">
                        {cotacoesCount} {cotacoesCount === 1 ? "cotação" : "cotações"}
                      </span>
                    </div>
                  </div>

                  {/* Detail Body */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4 pb-5">
                      {cotacoesCount > 0 ? (
                        <div className="space-y-2 mb-4">
                          {req.cotacoes.map((cot: any) => {
                            const isVencedora = cot.status === "aprovada";
                            const isPerdida = cot.status === "rejeitada" || (hasAprovada && !isVencedora); // Se tem vencedora, as outras perdem opacidade
                            const st = COTACAO_STATUS_MAP[isVencedora ? "aprovada" : (isPerdida ? "rejeitada" : "pendente")];
                            const diasAtraso = diasCotacaoAtrasada(cot);
                            
                            return (
                              <div 
                                key={cot.id}
                                onClick={() => { setSelectedCotacao({ ...cot, requisicao: req }); setCotacaoDetailOpen(true); }}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-background border transition-colors cursor-pointer hover:border-primary/40
                                  ${isVencedora ? 'border-green-500/50 shadow-sm' : ''} 
                                  ${isPerdida ? 'opacity-60' : ''}
                                `}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs text-muted-foreground">{cot.numero}</span>
                                  <span className={`text-sm font-medium ${isPerdida ? 'line-through text-muted-foreground' : ''}`}>
                                    {cot.fornecedor?.razao_social || "Fornecedor Removido"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 mt-2 sm:mt-0 text-sm">
                                  <span className="text-muted-foreground text-xs">
                                    Prazo: {cot.prazo_entrega_dias ? `${cot.prazo_entrega_dias}d` : '--'}
                                  </span>
                                  <span className={`font-semibold ${isVencedora ? 'text-green-700' : ''}`}>
                                    {fmt(cot.valor_total || 0)}
                                  </span>
                                  <Badge variant={st.variant} className={isVencedora ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                                    {st.label}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-xs text-muted-foreground mb-4 py-2">
                          Nenhuma cotação registrada ainda
                        </p>
                      )}

                      {/* Action Buttons Container */}
                      <div className="flex justify-end pt-2">
                        {hasActionPermission("pode_criar_cotacao") && (
                          <>
                            {req.workflow_status === "APPROVED" ? (
                              <Button 
                                variant="link" 
                                className="text-primary p-0 h-auto font-semibold"
                                onClick={() => onNavigate && onNavigate("pedidos", req.numero)}
                              >
                                Ver pedido gerado <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openNewCotacaoModal(req.id)}
                                className="bg-background shadow-sm"
                              >
                                {cotacoesCount === 0 ? <><Plus className="h-3 w-3 mr-1" /> Criar cotação</> : <><Plus className="h-3 w-3 mr-1" /> Adicionar cotação concorrente</>}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      
      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="border-t p-4 flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            {totalItems} {totalItems === 1 ? "registro encontrado" : "registros encontrados"}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Linhas por página</span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 30, 40, 50].map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center text-sm font-medium">
              Página {page} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Próxima</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Modal Nova Cotação */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReqLocked(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Cotação</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Requisição *</Label>
                <Select value={form.requisicao_id} onValueChange={(v) => handleReqChange(v)} disabled={reqLocked}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {requisicoesMestreDetalhe.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.numero} — {r.projeto?.codigo || ""} {r.projeto?.nome ? `· ${r.projeto.nome}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reqLocked && <p className="text-xs text-muted-foreground mt-1">Requisição pré-selecionada e bloqueada para esta cotação.</p>}
              </div>
              <div>
                <Label>Fornecedor *</Label>
                <Input
                  placeholder="Buscar fornecedor..."
                  value={fornecedorSearch}
                  onChange={(e) => setFornecedorSearch(e.target.value)}
                  className="mb-1 h-8"
                />
                <Select value={form.fornecedor_id} onValueChange={v => setForm(p => ({ ...p, fornecedor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f: any) => (
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
                      <TableHead>Unidade</TableHead>
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
                          <TableCell className="text-muted-foreground">{reqItem?.unidade || "—"}</TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" min="0" className="w-28" value={ci.preco_unitario || ""}
                              placeholder="0,00"
                              onChange={e => setCotItens(p => p.map((c, i) => i === idx ? { ...c, preco_unitario: Number(e.target.value) } : c))} />
                          </TableCell>
                          <TableCell className="font-medium">{fmt((ci.preco_unitario || 0) * ci.quantidade)}</TableCell>
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
                <p className="text-right font-semibold mt-2">Total: {fmt(cotItens.reduce((s, i) => s + (i.preco_unitario || 0) * i.quantidade, 0))}</p>
              </div>
            )}

            <div>
              <Label>Observações Gerais</Label>
              <Input value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>

            <Button onClick={handleSave} disabled={!form.requisicao_id || !form.fornecedor_id || createCotacao.isPending}>
              Registrar Cotação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <Badge variant={PRIORIDADE_MAP[selectedReqForDetail.prioridade]?.text.includes("red") ? "destructive" : "outline"}>
                    {PRIORIDADE_MAP[selectedReqForDetail.prioridade]?.label || selectedReqForDetail.prioridade}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-semibold">Itens Totais</span>
                  <span className="font-medium">{selectedReqForDetail.itens?.length || 0} itens solicitados</span>
                </div>
              </div>
              
              {(selectedReqForDetail.justificativa || selectedReqForDetail.observacoes) && (
                <div className="grid grid-cols-1 gap-4 text-sm">
                  {selectedReqForDetail.justificativa && (
                    <div className="border p-3 rounded-lg bg-yellow-50/30">
                      <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Justificativa</span>
                      <p className="whitespace-pre-wrap">{selectedReqForDetail.justificativa}</p>
                    </div>
                  )}
                  {selectedReqForDetail.observacoes && (
                    <div className="border p-3 rounded-lg bg-muted/20">
                      <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Observações Gerais</span>
                      <p className="whitespace-pre-wrap">{selectedReqForDetail.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4" /> 
                  Itens Detalhados ({selectedReqForDetail.itens?.length || 0})
                </h4>
                <div className="border rounded-md overflow-hidden max-h-[250px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Item / Descrição</TableHead>
                        <TableHead className="text-center w-20">Qtd</TableHead>
                        <TableHead className="w-20">Unid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedReqForDetail.itens || []).map((item: any) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Timeline
                </h4>
                <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <RequisitionTimeline requisicaoId={selectedReqForDetail.id} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhe da Cotação (Read-only Modal) */}
      <Dialog open={cotacaoDetailOpen} onOpenChange={setCotacaoDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Cotação</DialogTitle>
          </DialogHeader>
          {selectedCotacao && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold font-mono text-primary">{selectedCotacao.numero}</h3>
                  <p className="text-sm text-muted-foreground">Fornecedor: {selectedCotacao.fornecedor?.razao_social}</p>
                </div>
                <Badge variant={COTACAO_STATUS_MAP[selectedCotacao.status]?.variant || "outline"} className="text-base py-1">
                  {COTACAO_STATUS_MAP[selectedCotacao.status]?.label || selectedCotacao.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-3 rounded-lg border">
                <div><span className="text-muted-foreground block text-xs">Requisição Ref.</span> <span className="font-mono">{selectedCotacao.requisicao?.numero}</span></div>
                <div><span className="text-muted-foreground block text-xs">Valor Total</span> <span className="font-semibold text-green-700">{fmt(selectedCotacao.valor_total || 0)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Prazo de Entrega</span> {selectedCotacao.prazo_entrega_dias ? `${selectedCotacao.prazo_entrega_dias} dias` : "—"}</div>
                <div><span className="text-muted-foreground block text-xs">Validade da Proposta</span> {selectedCotacao.validade ? parseLocalDate(selectedCotacao.validade).toLocaleDateString("pt-BR") : "—"}</div>
                <div><span className="text-muted-foreground block text-xs">Frete</span> {selectedCotacao.frete ? fmt(selectedCotacao.frete) : "Incluso/Grátis"}</div>
                <div className="col-span-3"><span className="text-muted-foreground block text-xs">Condição Pagamento</span> {selectedCotacao.condicao_pagamento || "—"}</div>
              </div>

              {selectedCotacao.observacoes && (
                <div className="text-sm border p-3 rounded-lg">
                  <span className="text-muted-foreground block text-xs uppercase font-semibold mb-1">Observações da Cotação</span>
                  <p className="whitespace-pre-wrap">{selectedCotacao.observacoes}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-2">Itens Cotados ({selectedCotacao.itens?.length || 0})</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid</TableHead>
                        <TableHead className="text-right">Vlr Unitário</TableHead>
                        <TableHead className="text-right">Vlr Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCotacao.itens?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.req_item?.sc_item?.codigo || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {item.req_item?.sc_item?.descricao || item.req_item?.descricao_livre || "—"}
                            {item.observacao && <span className="block text-xs text-muted-foreground italic mt-0.5">Obs: {item.observacao}</span>}
                          </TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-muted-foreground">{item.req_item?.unidade}</TableCell>
                          <TableCell className="text-right">{fmt(item.preco_unitario || 0)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt((item.preco_unitario || 0) * item.quantidade)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
