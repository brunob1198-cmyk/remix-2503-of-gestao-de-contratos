import { useMinhaFila } from "@/hooks/useSupplyChain";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Clock, AlertCircle } from "lucide-react";
import { DataTable, DataTableColumnHeader, DataTableColumnFilter, multiSelectFilter } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  ESTADOS_REQUISICAO,
  ESTADO_REQUISICAO_LABEL,
  ESTADOS_PEDIDO,
  ESTADO_PEDIDO_LABEL,
  normalizarEstadoRequisicao,
  rotuloRequisicao,
  rotuloPedido,
} from "@/lib/fluxoCompras";

// Rótulo, variante e ajuda vêm de `@/lib/fluxoCompras`. Os dois mapas locais que
// estavam aqui eram mais duas cópias do vocabulário de status.
function requisicaoStatusBadge(workflow_status: string) {
  const r = rotuloRequisicao(workflow_status);
  return (
    <Badge variant={r.variante} className="text-[10px] px-1.5 py-0" title={r.ajuda}>
      {r.label}
    </Badge>
  );
}

function pedidoStatusBadge(status: string) {
  const r = rotuloPedido(status);
  return (
    <Badge variant={r.variante} className="text-[10px] px-1.5 py-0" title={r.ajuda}>
      {r.label}
    </Badge>
  );
}

// Columns definition for Requisicoes
const reqColumns = (abrir: (r: any) => void): ColumnDef<any>[] => [
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
          options={ESTADOS_REQUISICAO.map(e => ({ label: ESTADO_REQUISICAO_LABEL[e], value: e }))}
        />
      </div>
    ),
    filterFn: multiSelectFilter,
    cell: ({ row }) => requisicaoStatusBadge(row.getValue("workflow_status")),
  },
  {
    id: "actions",
    // O botão não tinha `onClick`. Esta é a aba que abre por padrão: a fila dizia
    // que havia trabalho e não dava caminho para fazê-lo.
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Abrir na aba correspondente"
        onClick={() => abrir(row.original)}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
    ),
  },
];

// Columns definition for Pedidos
const pedColumns = (abrir: (p: any) => void): ColumnDef<any>[] => [
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
          options={ESTADOS_PEDIDO.map(e => ({ label: ESTADO_PEDIDO_LABEL[e], value: e }))}
        />
      </div>
    ),
    filterFn: multiSelectFilter,
    cell: ({ row }) => pedidoStatusBadge(row.getValue("status")),
  },
  {
    id: "actions",
    // O botão não tinha `onClick`. Esta é a aba que abre por padrão: a fila dizia
    // que havia trabalho e não dava caminho para fazê-lo.
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Abrir na aba correspondente"
        onClick={() => abrir(row.original)}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
    ),
  },
];


interface MinhaFilaTabProps {
  /**
   * Leva o registro para a aba onde ele pode ser trabalhado.
   *
   * Sem isto a fila era terminal: mostrava o número e deixava o usuário descobrir
   * sozinho em qual aba encontrá-lo.
   */
  onNavigate?: (tab: string, filter?: string) => void;
}

export function MinhaFilaTab({ onNavigate }: MinhaFilaTabProps) {
  const { data, isLoading } = useMinhaFila();
  const { hasActionPermission } = usePermissions();

  /**
   * A aba de destino depende do estado da requisição: o que se faz com ela em
   * cotação é diferente do que se faz com ela em aprovação. Mandar tudo para a aba
   * de Requisições daria um clique a mais em todos os casos.
   */
  const abrirRequisicao = (r: any) => {
    const estado = normalizarEstadoRequisicao(r.workflow_status);
    const destino =
      estado === "QUOTING"
        ? "cotacoes"
        : estado === "PENDING_APPROVAL"
          ? "comparativo"
          : estado === "APPROVED" || estado === "PURCHASED" || estado === "PARTIALLY_RECEIVED"
            ? "pedidos"
            : "requisicoes";
    onNavigate?.(destino, r.numero ?? r.id);
  };

  const abrirPedido = (ped: any) => onNavigate?.("pedidos", ped.id);

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
        <DataTable 
          columns={reqColumns(abrirRequisicao)} 
          data={rows} 
          searchKey="numero" 
          searchPlaceholder="Buscar por número..." 
          persistKey={`sc_fila_req_${title.toLowerCase().replace(/\s+/g, '_')}`}
        />

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
        <DataTable 
          columns={pedColumns(abrirPedido)} 
          data={rows} 
          searchKey="numero" 
          searchPlaceholder="Buscar por número..." 
          persistKey={`sc_fila_ped_${title.toLowerCase().replace(/\s+/g, '_')}`}
        />

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
