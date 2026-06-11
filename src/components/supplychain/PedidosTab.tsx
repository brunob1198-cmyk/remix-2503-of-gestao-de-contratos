import { useState } from "react";
import { usePedidosCompra } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star, CheckCircle } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { RecebimentoModal } from "./RecebimentoModal";
import { AvaliacaoFornecedorModal } from "./AvaliacaoFornecedorModal";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  emitido: { label: "Emitido", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "default" },
  em_transito: { label: "Em Trânsito", variant: "secondary" },
  entrega_parcial: { label: "Entrega Parcial", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export function PedidosTab({ filter }: { filter?: string }) {
  const { pedidos: allPedidos, isLoading, updateStatus, remove } = usePedidosCompra();
  
  const pedidos = filter === "OPEN"
    ? allPedidos.filter((p: any) => ["emitido", "confirmado", "em_transito", "entrega_parcial"].includes(p.status))
    : allPedidos;
    
  const { hasActionPermission } = usePermissions();
  
  // State for Avaliacao modal
  const [pedidoToAvaliar, setPedidoToAvaliar] = useState<any>(null);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleRecebido = (pedidoId: string) => {
    // Apenas marca que recebeu, os dados recarregam automaticamente.
    // Pode-se verificar se está 100% recebido e forçar status 'entregue', 
    // mas o usuário também pode finalizar o pedido manualmente com o botão.
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pedidos e Recebimentos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Entrega Prevista</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[300px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p: any) => {
                  const st = STATUS_MAP[p.status] || { label: p.status, variant: "outline" as const };
                  const canReceive = ["emitido", "confirmado", "em_transito", "entrega_parcial"].includes(p.status);
                  
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.numero}</TableCell>
                      <TableCell>{p.fornecedor?.razao_social || "—"}</TableCell>
                      <TableCell>{p.data_emissao ? parseLocalDate(p.data_emissao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell>{p.data_entrega_prevista ? parseLocalDate(p.data_entrega_prevista).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell>{fmt(p.valor_total || 0)}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {p.status === "rascunho" && (
                            <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "emitido" })}>
                              Emitir Pedido
                            </Button>
                          )}
                          {p.status === "emitido" && (
                            <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "confirmado" })}>
                              Confirmar
                            </Button>
                          )}
                          {canReceive && (
                            <RecebimentoModal pedido={p} onRecebido={() => handleRecebido(p.id)} />
                          )}
                          {canReceive && (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "entregue" })}>
                              <CheckCircle className="h-4 w-4 mr-1 text-green-600" /> Finalizar
                            </Button>
                          )}
                          {p.status === "entregue" && (
                            <Button variant="outline" size="sm" className="gap-1 text-yellow-600 border-yellow-200 hover:bg-yellow-50" onClick={() => setPedidoToAvaliar(p)}>
                              <Star className="h-4 w-4 fill-yellow-600" /> Avaliar
                            </Button>
                          )}
                          {p.status === "rascunho" && (
                            <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      
      {pedidoToAvaliar && (
        <AvaliacaoFornecedorModal 
          pedido={pedidoToAvaliar} 
          open={!!pedidoToAvaliar} 
          onOpenChange={(v) => !v && setPedidoToAvaliar(null)} 
        />
      )}
    </Card>
  );
}

