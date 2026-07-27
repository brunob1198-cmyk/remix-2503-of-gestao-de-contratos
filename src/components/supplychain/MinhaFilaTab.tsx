import { useMinhaFila } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, AlertCircle } from "lucide-react";
import { DataTable, DataTableColumnHeader, DataTableColumnFilter, multiSelectFilter } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  WORKFLOW_STATUS_OPTIONS,
  getStatusLabel,
  getStatusVariant,
} from "@/lib/requisicaoStatus";

// Pedido (purchase order) statuses remain in Portuguese lowercase for now.
const PEDIDO_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  emitido: { label: "Emitido", variant: "default" },
  confirmado: { label: "Confirmado", variant: "default" },
  entrega_parcial: { label: "Entrega Parcial", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

function requisicaoStatusBadge(workflow_status: string) {
  return (
    <Badge variant={getStatusVariant(workflow_status)} className="text-[10px] px-1.5 py-0">
      {getStatusLabel(workflow_status)}
    </Badge>
  );
}

function pedidoStatusBadge(status: string) {
  const cfg = PEDIDO_STATUS_MAP[status] || { label: status, variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
      {cfg.label}
    </Badge>
  );
}

// Columns definition for Requisicoes
const reqColumns: ColumnDef<any>[] = [
  {
    accessorKey: "numero",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("numero")}</span>,
  },
  {
    accessorKey: "projeto",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Projeto" />,
    accessorFn: (row) => row.projeto?.codigo || "—",
    cell: ({ row }) => <span className="text-sm">{row.getValue("projeto")}</span>,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Data" />,
    cell: ({ row }) => {
      const val = row.getValue("created_at") as string;
      return <span className="text-sm">{val ? new Date(val).toLocaleDateString("pt-BR") : "—"}</span>;
    },
  },
  {
    accessorKey: "workflow_status",
    header: ({ column }) => (
      <div className="flex items-center">
        <DataTableColumnHeader column={column} title="Status" />
        <DataTableColumnFilter
          column={column}
          title="Filtro Status"
          options={WORKFLOW_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
        />
      </div>
    ),
    filterFn: multiSelectFilter,
    cell: ({ row }) => requisicaoStatusBadge(row.getValue("workflow_status")),
  },
  {
    id: "actions",
    cell: () => (
      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
    ),
  },
];

// Columns definition for Pedidos
const pedColumns: ColumnDef<any>[] = [
  {
    accessorKey: "numero",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("numero")}</span>,
  },
  {
    accessorKey: "fornecedor",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fornecedor" />,
    accessorFn: (row) => row.fornecedor?.razao_social || "—",
    cell: ({ row }) => <span className="text-sm">{row.getValue("fornecedor")}</span>,
  },
  {
    accessorKey: "data_prevista_entrega",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Prev. Entrega" />,
    cell: ({ row }) => {
      const val = row.getValue("data_prevista_entrega") as string;
      return <span className="text-sm">{val ? new Date(val).toLocaleDateString("pt-BR") : "—"}</span>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <div className="flex items-center">
        <DataTableColumnHeader column={column} title="Status" />
        <DataTableColumnFilter
          column={column}
          title="Filtro Status"
          options={Object.keys(PEDIDO_STATUS_MAP).map(k => ({ label: PEDIDO_STATUS_MAP[k].label, value: k }))}
        />
      </div>
    ),
    filterFn: multiSelectFilter,
    cell: ({ row }) => pedidoStatusBadge(row.getValue("status")),
  },
  {
    id: "actions",
    cell: () => (
      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
    ),
  },
];


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
      {rows.length === 0 ? (
        <div className="text-center py-4 border rounded-md text-muted-foreground italic">{emptyMsg}</div>
      ) : (
        <DataTable columns={reqColumns} data={rows} searchKey="numero" searchPlaceholder="Buscar por número..." />
      )}
    </div>
  );

  const renderPedSection = (title: string, rows: any[], emptyMsg: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        {title}
        <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
      </h3>
      {rows.length === 0 ? (
        <div className="text-center py-4 border rounded-md text-muted-foreground italic">{emptyMsg}</div>
      ) : (
        <DataTable columns={pedColumns} data={rows} searchKey="numero" searchPlaceholder="Buscar por número..." />
      )}
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
