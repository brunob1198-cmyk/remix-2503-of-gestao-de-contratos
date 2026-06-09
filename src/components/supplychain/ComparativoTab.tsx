import { useState, useMemo } from "react";
import { useCotacoes, useRequisicoes } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, Star, TrendingDown, Clock, ShieldCheck, Truck } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

export function ComparativoTab() {
  const { requisicoes, updateStatus: updateReqStatus } = useRequisicoes();
  const { cotacoes, updateStatus: updateCotStatus } = useCotacoes();
  const { hasActionPermission } = usePermissions();
  
  const [selectedReqId, setSelectedReqId] = useState<string>("");

  // Filter requests that are in quoting or completed quoting stage
  const eligibleRequisicoes = requisicoes.filter(r => 
    ["QUOTING", "QUOTE_COMPLETED", "SUBMITTED"].includes(r.workflow_status)
  );

  // Get quotes for the selected request
  const relevantCotacoes = useMemo(() => {
    if (!selectedReqId) return [];
    return cotacoes.filter(c => c.requisicao_id === selectedReqId);
  }, [cotacoes, selectedReqId]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Heuristics for highlighting (mocking historic evaluation for now)
  const highlights = useMemo(() => {
    if (relevantCotacoes.length === 0) return { minPrice: null, minLeadTime: null, bestRating: null };
    
    let minPrice = relevantCotacoes[0].id;
    let minLeadTime = relevantCotacoes[0].id;
    let bestRating = relevantCotacoes[0].id;

    relevantCotacoes.forEach(c => {
      if ((c.valor_total || 0) < (relevantCotacoes.find(x => x.id === minPrice)?.valor_total || Infinity)) {
        minPrice = c.id;
      }
      if ((c.prazo_entrega_dias || Infinity) < (relevantCotacoes.find(x => x.id === minLeadTime)?.prazo_entrega_dias || Infinity)) {
        minLeadTime = c.id;
      }
      // Mocking rating: Fornecedor ID length or something stable
      if ((c.fornecedor?.razao_social?.length || 0) % 5 > (relevantCotacoes.find(x => x.id === bestRating)?.fornecedor?.razao_social?.length || 0) % 5) {
          bestRating = c.id;
      }
    });

    return { minPrice, minLeadTime, bestRating };
  }, [relevantCotacoes]);

  const handleSelectWinner = (cotacao: any) => {
    if (!hasActionPermission("pode_criar_pedido")) return;
    
    // Update the winner quote status to "aprovada"
    updateCotStatus.mutate({ id: cotacao.id, status: "aprovada" });
    
    // Move the request to PENDING_APPROVAL
    updateReqStatus.mutate({ id: cotacao.requisicao_id, workflow_status: "PENDING_APPROVAL" });
    
    // Set other quotes for same request to "rejeitada"
    relevantCotacoes.forEach(c => {
        if (c.id !== cotacao.id) {
            updateCotStatus.mutate({ id: c.id, status: "rejeitada" });
        }
    });
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
                {eligibleRequisicoes.map(r => (
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

                    return (
                      <TableRow key={c.id} className={isWinner ? "bg-primary/5" : ""}>
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
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleSelectWinner(c)}
                              disabled={!hasActionPermission("pode_criar_pedido")}
                            >
                              Escolher
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

      {selectedReqId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg text-green-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Economia Potencial</p>
                  <h4 className="text-xl font-bold text-green-700">
                    {fmt((relevantCotacoes.reduce((max, c) => Math.max(max, c.valor_total || 0), 0)) - (relevantCotacoes.find(c => c.id === highlights.minPrice)?.valor_total || 0))}
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Entrega Mais Rápida</p>
                  <h4 className="text-xl font-bold text-blue-700">
                    {relevantCotacoes.find(c => c.id === highlights.minLeadTime)?.prazo_entrega_dias || "—"} dias
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">Qtd Cotações</p>
                  <h4 className="text-xl font-bold text-primary">
                    {relevantCotacoes.length} fornecedores
                  </h4>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
