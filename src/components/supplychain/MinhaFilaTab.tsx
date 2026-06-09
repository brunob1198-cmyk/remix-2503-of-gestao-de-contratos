import { useRequisicoes, usePedidosCompra } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, AlertCircle } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

const WORKFLOW_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "secondary" },
  SUBMITTED: { label: "Enviado", variant: "default" },
  QUOTING: { label: "Em Cotação", variant: "outline" },
  QUOTE_COMPLETED: { label: "Cotação Finalizada", variant: "default" },
  PENDING_APPROVAL: { label: "Pendente Aprovação", variant: "outline" },
  APPROVED: { label: "Aprovado", variant: "default" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
  PURCHASE_ORDER_CREATED: { label: "Pedido Criado", variant: "outline" },
  PURCHASED: { label: "Comprado", variant: "default" },
  PARTIALLY_RECEIVED: { label: "Recebimento Parcial", variant: "outline" },
  RECEIVED: { label: "Recebido", variant: "default" },
  CLOSED: { label: "Finalizado", variant: "secondary" },
};

export function MinhaFilaTab() {
  const { user } = useAuth();
  const { requisicoes } = useRequisicoes();
  const { pedidos } = usePedidosCompra();
  const { hasActionPermission } = usePermissions();

  // Define logical profiles based on permissions
  const isRequisitante = true; // Everyone can be a requisitante
  const isCompras = hasActionPermission("pode_criar_cotacao") || hasActionPermission("pode_criar_pedido");
  const isGestor = hasActionPermission("pode_aprovar_compra");
  const isAlmoxarifado = hasActionPermission("pode_receber_compra");

  // Filter logic for "Minha Fila"
  const minhasRequisicoes = requisicoes.filter(r => r.solicitante_id === user?.id);
  
  const requisicoesParaCotar = isCompras 
    ? requisicoes.filter(r => ["SUBMITTED", "QUOTING"].includes(r.workflow_status))
    : [];
    
  const pedidosParaEmitir = isCompras
    ? requisicoes.filter(r => r.workflow_status === "APPROVED")
    : [];

  const aprovacoesPendentes = isGestor
    ? requisicoes.filter(r => r.workflow_status === "PENDING_APPROVAL")
    : [];

  const recebimentosPendentes = isAlmoxarifado
    ? requisicoes.filter(r => ["PURCHASED", "PARTIALLY_RECEIVED"].includes(r.workflow_status))
    : [];

  const renderSection = (title: string, data: any[], emptyMsg: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        {title} 
        <Badge variant="secondary" className="ml-1">{data.length}</Badge>
      </h3>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground italic">{emptyMsg}</TableCell>
              </TableRow>
            ) : (
              data.slice(0, 5).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                  <TableCell className="text-sm">{r.projeto?.codigo || "—"}</TableCell>
                  <TableCell className="text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={WORKFLOW_STATUS_MAP[r.workflow_status]?.variant || "outline"} className="text-[10px] px-1.5 py-0">
                      {WORKFLOW_STATUS_MAP[r.workflow_status]?.label || r.workflow_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Minha Fila de Trabalho
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile: REQUISITANTE */}
        {isRequisitante && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge>REQUISITANTE</Badge>
            </div>
            {renderSection("Minhas Requisições", minhasRequisicoes, "Nenhuma requisição criada por você.")}
          </div>
        )}

        {/* Profile: GESTOR */}
        {isGestor && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">GESTOR</Badge>
            </div>
            {renderSection("Aprovações Pendentes", aprovacoesPendentes, "Nenhuma aprovação pendente.")}
          </div>
        )}

        {/* Profile: COMPRAS */}
        {isCompras && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">COMPRAS</Badge>
            </div>
            {renderSection("Requisições para Cotar", requisicoesParaCotar, "Nada para cotar no momento.")}
            {renderSection("Pedidos para Emitir", pedidosParaEmitir, "Nenhuma aprovação pronta para virar pedido.")}
          </div>
        )}

        {/* Profile: ALMOXARIFADO */}
        {isAlmoxarifado && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">ALMOXARIFADO</Badge>
            </div>
            {renderSection("Recebimentos Pendentes", recebimentosPendentes, "Nenhum recebimento aguardado.")}
          </div>
        )}

        {!(isGestor || isCompras || isAlmoxarifado) && minhasRequisicoes.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Sua fila de trabalho está vazia.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
