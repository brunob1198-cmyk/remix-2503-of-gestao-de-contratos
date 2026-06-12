import { useMinhaFila } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, AlertCircle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  pendente_aprovacao: { label: "Pendente Aprovação", variant: "outline" },
  em_cotacao: { label: "Em Cotação", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
  pedido_emitido: { label: "Pedido Emitido", variant: "default" },
  emitido: { label: "Emitido", variant: "default" },
  confirmado: { label: "Confirmado", variant: "default" },
  entrega_parcial: { label: "Entrega Parcial", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function statusBadge(status: string) {
  const cfg = STATUS_MAP[status] || { label: status, variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
      {cfg.label}
    </Badge>
  );
}

export function MinhaFilaTab() {
  const { data, isLoading } = useMinhaFila();
  const { hasActionPermission } = usePermissions();

  const isRequisitante = true;
  const isCompras = hasActionPermission("pode_criar_cotacao") || hasActionPermission("pode_criar_pedido");
  const isGestor = hasActionPermission("pode_aprovar_compra");
  const isAlmoxarifado = hasActionPermission("pode_receber_compra");

  const minhasRequisicoes = data?.minhasRequisicoes || [];
  const requisicoesParaCotar = data?.requisicoesParaCotar || [];
  const pedidosParaEmitir = data?.pedidosParaEmitir || [];
  const aprovacoesPendentes = data?.aprovacoesPendentes || [];
  const recebimentosPendentes = data?.recebimentosPendentes || [];

  const renderReqSection = (title: string, rows: any[], emptyMsg: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        {title}
        <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground italic">{emptyMsg}</TableCell>
              </TableRow>
            ) : (
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                  <TableCell className="text-sm">{r.projeto?.codigo || "—"}</TableCell>
                  <TableCell className="text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
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

  const renderPedSection = (title: string, rows: any[], emptyMsg: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        {title}
        <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
      </h3>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Prev. Entrega</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground italic">{emptyMsg}</TableCell>
              </TableRow>
            ) : (
              rows.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                  <TableCell className="text-sm">{p.fornecedor?.razao_social || "—"}</TableCell>
                  <TableCell className="text-sm">{p.data_prevista_entrega ? new Date(p.data_prevista_entrega).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
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
        {isRequisitante && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge>REQUISITANTE</Badge>
            </div>
            {renderReqSection("Minhas Requisições", minhasRequisicoes, "Nenhuma requisição criada por você.")}
          </div>
        )}

        {isGestor && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">GESTOR</Badge>
            </div>
            {renderReqSection("Aprovações Pendentes", aprovacoesPendentes, "Nenhuma aprovação pendente.")}
          </div>
        )}

        {isCompras && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">COMPRAS</Badge>
            </div>
            {renderReqSection("Requisições para Cotar", requisicoesParaCotar, "Nada para cotar no momento.")}
            {renderPedSection("Pedidos para Emitir", pedidosParaEmitir, "Nenhum pedido em rascunho.")}
          </div>
        )}

        {isAlmoxarifado && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">ALMOXARIFADO</Badge>
            </div>
            {renderPedSection("Recebimentos Pendentes", recebimentosPendentes, "Nenhum recebimento aguardado.")}
          </div>
        )}

        {!isLoading && !(isGestor || isCompras || isAlmoxarifado) && minhasRequisicoes.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Sua fila de trabalho está vazia.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
