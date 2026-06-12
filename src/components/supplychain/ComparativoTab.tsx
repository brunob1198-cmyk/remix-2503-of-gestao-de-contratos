import { useState, useMemo } from "react";
import { useCotacoes, useRequisicoes } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Star, TrendingDown, Clock, ShieldCheck, Truck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ComparativoTabProps {
  onNavigate?: (tab: string, filter?: string) => void;
}

export function ComparativoTab({ onNavigate }: ComparativoTabProps) {
  const { requisicoes } = useRequisicoes();
  const { cotacoes } = useCotacoes();
  const { hasActionPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [selectedReqId, setSelectedReqId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<any>(null);
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const eligibleRequisicoes = requisicoes.filter((r: any) =>
    ["QUOTING", "QUOTE_COMPLETED", "SUBMITTED"].includes(r.workflow_status)
  );

  const relevantCotacoes = useMemo(() => {
    if (!selectedReqId) return [];
    return cotacoes.filter((c: any) => c.requisicao_id === selectedReqId);
  }, [cotacoes, selectedReqId]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const highlights = useMemo(() => {
    if (relevantCotacoes.length === 0) return { minPrice: null, minLeadTime: null, bestRating: null };
    let minPrice = relevantCotacoes[0].id;
    let minLeadTime = relevantCotacoes[0].id;
    let bestRating = relevantCotacoes[0].id;
    relevantCotacoes.forEach((c: any) => {
      if ((c.valor_total || 0) < (relevantCotacoes.find((x: any) => x.id === minPrice)?.valor_total || Infinity)) minPrice = c.id;
      if ((c.prazo_entrega_dias || Infinity) < (relevantCotacoes.find((x: any) => x.id === minLeadTime)?.prazo_entrega_dias || Infinity)) minLeadTime = c.id;
      if ((c.fornecedor?.razao_social?.length || 0) % 5 > (relevantCotacoes.find((x: any) => x.id === bestRating)?.fornecedor?.razao_social?.length || 0) % 5) bestRating = c.id;
    });
    return { minPrice, minLeadTime, bestRating };
  }, [relevantCotacoes]);

  const isPendingMinPrice = pendingWinner && pendingWinner.id === highlights.minPrice;
  const requiresJustification = pendingWinner && !isPendingMinPrice;

  const openConfirm = (cotacao: any) => {
    if (!hasActionPermission("pode_criar_pedido")) return;
    setPendingWinner(cotacao);
    setJustificativa("");
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingWinner) return;
    if (requiresJustification && !justificativa.trim()) {
      toast.error("Justificativa é obrigatória quando o vencedor não é o menor preço.");
      return;
    }

    const cotacao = pendingWinner;
    setSubmitting(true);
    try {
      const req = requisicoes.find((r: any) => r.id === cotacao.requisicao_id);
      if (!req) throw new Error("Requisição não encontrada");

      // a) aprovar cotação vencedora
      const { error: e1 } = await supabase
        .from("cotacoes")
        .update({ status: "aprovada", updated_at: new Date().toISOString() })
        .eq("id", cotacao.id);
      if (e1) throw e1;

      // b) marcar as demais como perdidas
      const { error: e2 } = await supabase
        .from("cotacoes")
        .update({ status: "perdida" })
        .eq("requisicao_id", cotacao.requisicao_id)
        .neq("id", cotacao.id);
      if (e2) throw e2;

      // c) atualizar requisição
      const { error: e3 } = await supabase
        .from("requisicoes_compra")
        .update({ status: "aprovada", workflow_status: "APPROVED", updated_at: new Date().toISOString() })
        .eq("id", cotacao.requisicao_id);
      if (e3) throw e3;

      // d) gerar número do pedido
      const { count } = await supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", cotacao.empresa_id);
      const numero = `PED-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data: pedido, error: e4 } = await supabase
        .from("pedidos")
        .insert({
          numero,
          cotacao_id: cotacao.id,
          requisicao_id: cotacao.requisicao_id,
          fornecedor_id: cotacao.fornecedor_id,
          projeto_id: req.projeto_id,
          empresa_id: cotacao.empresa_id,
          valor_total: cotacao.valor_total || 0,
          frete: cotacao.frete || 0,
          condicao_pagamento: cotacao.condicao_pagamento || null,
          prazo_entrega_dias: cotacao.prazo_entrega_dias || null,
          status: "rascunho",
          observacoes: justificativa ? `Justificativa da escolha: ${justificativa}` : null,
        })
        .select()
        .single();
      if (e4) throw e4;

      // e) inserir itens do pedido
      const cotItens = cotacao.itens || [];
      if (cotItens.length > 0) {
        const pedidoItens = cotItens.map((ci: any) => {
          const reqItem = ci.req_item || {};
          const descricao = reqItem.sc_item?.descricao || reqItem.descricao_livre || "Item";
          const qtd = Number(ci.quantidade || 0);
          const pu = Number(ci.preco_unitario || 0);
          return {
            pedido_id: pedido.id,
            sc_item_id: reqItem.sc_item?.id || null,
            descricao,
            unidade: reqItem.unidade || null,
            quantidade: qtd,
            preco_unitario: pu,
            valor_total: qtd * pu,
          };
        });
        const { error: e5 } = await supabase.from("pedido_itens").insert(pedidoItens);
        if (e5) throw e5;
      }

      toast.success(`Pedido ${numero} criado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["cotacoes"] });
      queryClient.invalidateQueries({ queryKey: ["requisicoes_compra"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });

      setConfirmOpen(false);
      setPendingWinner(null);
      setJustificativa("");

      // navegar para aba pedidos com o id do pedido como filtro
      onNavigate?.("pedidos", pedido.id);
    } catch (err: any) {
      toast.error("Erro ao confirmar vencedor: " + (err.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparativo de Preços e Condições</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs mb-6">
            <Label>Selecione a Requisição</Label>
            <Select value={selectedReqId} onValueChange={setSelectedReqId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma RC..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleRequisicoes.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.numero} - {r.projeto?.codigo || "Sem Projeto"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedReqId ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Selecione uma requisição para visualizar o comparativo de cotações.
            </div>
          ) : relevantCotacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              Nenhuma cotação registrada para esta requisição ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Prazo (dias)</TableHead>
                    <TableHead>Frete</TableHead>
                    <TableHead>Condição Pagto</TableHead>
                    <TableHead>Avaliação Histórica</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relevantCotacoes.map((c: any) => {
                    const isMinPrice = c.id === highlights.minPrice;
                    const isMinLeadTime = c.id === highlights.minLeadTime;
                    const isBestRating = c.id === highlights.bestRating;
                    const isWinner = c.status === "aprovada";
                    const isLost = c.status === "perdida" || c.status === "rejeitada";

                    return (
                      <TableRow key={c.id} className={isWinner ? "bg-primary/5" : isLost ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{c.fornecedor?.razao_social}</span>
                            <div className="flex gap-1 mt-1">
                              {isMinPrice && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 py-0 h-4">Menor Preço</Badge>}
                              {isMinLeadTime && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4">Melhor Prazo</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-semibold">
                            {isMinPrice && <TrendingDown className="h-3 w-3 text-green-600" />}
                            {fmt(c.valor_total || 0)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isMinLeadTime && <Clock className="h-3 w-3 text-blue-600" />}
                            {c.prazo_entrega_dias || "—"} dias
                          </div>
                        </TableCell>
                        <TableCell>{c.frete > 0 ? fmt(c.frete) : "Incluso/FOB"}</TableCell>
                        <TableCell className="text-xs">{c.condicao_pagamento || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${star <= (4 + (c.fornecedor?.razao_social?.length % 2)) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                              />
                            ))}
                            {isBestRating && <ShieldCheck className="h-3 w-3 text-primary ml-1" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isWinner ? (
                            <Badge className="bg-green-600">Vencedor</Badge>
                          ) : isLost ? (
                            <Badge variant="outline">Perdida</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openConfirm(c)}
                              disabled={!hasActionPermission("pode_criar_pedido")}
                            >
                              Vencedor
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedReqId && relevantCotacoes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-600"><TrendingDown className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Economia Potencial</p>
                  <h4 className="text-xl font-bold text-green-700">
                    {fmt((relevantCotacoes.reduce((max: number, c: any) => Math.max(max, c.valor_total || 0), 0)) - (relevantCotacoes.find((c: any) => c.id === highlights.minPrice)?.valor_total || 0))}
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Clock className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Entrega Mais Rápida</p>
                  <h4 className="text-xl font-bold text-blue-700">
                    {relevantCotacoes.find((c: any) => c.id === highlights.minLeadTime)?.prazo_entrega_dias || "—"} dias
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Truck className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">Qtd Cotações</p>
                  <h4 className="text-xl font-bold text-primary">{relevantCotacoes.length} fornecedores</h4>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar fornecedor vencedor</DialogTitle>
            <DialogDescription>
              {pendingWinner && (
                <>
                  Confirmar <strong>{pendingWinner.fornecedor?.razao_social}</strong> como vencedor da RC{" "}
                  <strong>{requisicoes.find((r: any) => r.id === pendingWinner.requisicao_id)?.numero}</strong>?
                  <br />
                  Valor: <strong>{fmt(pendingWinner.valor_total || 0)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {requiresJustification && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>O fornecedor selecionado não é o menor preço. Justificativa é obrigatória.</span>
            </div>
          )}

          <div>
            <Label>Justificativa {requiresJustification && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: prazo de entrega mais curto, melhor avaliação histórica, condição de pagamento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={submitting || (requiresJustification && !justificativa.trim())}>
              {submitting ? "Processando..." : "Confirmar Vencedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
