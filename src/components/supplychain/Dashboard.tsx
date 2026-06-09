import { Card, CardContent } from "@/components/ui/card";
import { useRequisicoes, useCotacoes, usePedidosCompra } from "@/hooks/useSupplyChain";
import { ClipboardCheck, FileText, ShoppingCart, Truck, Package } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  isActive: boolean;
}

function DashboardCard({ title, value, icon: Icon, color, onClick, isActive }: DashboardCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${isActive ? 'ring-2 ring-primary bg-primary/5 shadow-md' : 'hover:shadow-sm'}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

export function SupplyChainDashboard({ onFilterChange, activeFilter }: { onFilterChange: (tab: string, filter?: string) => void, activeFilter: { tab: string, filter?: string } }) {
  const { requisicoes } = useRequisicoes();
  const { cotacoes } = useCotacoes();
  const { pedidos } = usePedidosCompra();

  const stats = {
    requisicoesPendentes: requisicoes.filter(r => r.workflow_status === "SUBMITTED").length,
    emCotacao: requisicoes.filter(r => r.workflow_status === "QUOTING").length,
    aguardandoAprovacao: requisicoes.filter(r => r.workflow_status === "PENDING_APPROVAL").length,
    pedidosEmAberto: pedidos.filter(p => ["emitido", "confirmado", "em_transito"].includes(p.status)).length,
    recebimentosPendentes: requisicoes.filter(r => ["PURCHASED", "PARTIALLY_RECEIVED"].includes(r.workflow_status)).length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <DashboardCard
        title="RCs Pendentes"
        value={stats.requisicoesPendentes}
        icon={FileText}
        color="bg-blue-500"
        onClick={() => onFilterChange("requisicoes", "SUBMITTED")}
        isActive={activeFilter.tab === "requisicoes" && activeFilter.filter === "SUBMITTED"}
      />
      <DashboardCard
        title="Em Cotação"
        value={stats.emCotacao}
        icon={ClipboardCheck}
        color="bg-orange-500"
        onClick={() => onFilterChange("cotacoes", "QUOTING")}
        isActive={activeFilter.tab === "cotacoes" && activeFilter.filter === "QUOTING"}
      />
      <DashboardCard
        title="Para Aprovar"
        value={stats.aguardandoAprovacao}
        icon={ShoppingCart}
        color="bg-purple-500"
        onClick={() => onFilterChange("requisicoes", "PENDING_APPROVAL")}
        isActive={activeFilter.tab === "requisicoes" && activeFilter.filter === "PENDING_APPROVAL"}
      />
      <DashboardCard
        title="Pedidos Abertos"
        value={stats.pedidosEmAberto}
        icon={Truck}
        color="bg-indigo-500"
        onClick={() => onFilterChange("pedidos", "OPEN")}
        isActive={activeFilter.tab === "pedidos" && activeFilter.filter === "OPEN"}
      />
      <DashboardCard
        title="Para Receber"
        value={stats.recebimentosPendentes}
        icon={Package}
        color="bg-green-500"
        onClick={() => onFilterChange("requisicoes", "TO_RECEIVE")}
        isActive={activeFilter.tab === "requisicoes" && activeFilter.filter === "TO_RECEIVE"}
      />
    </div>
  );
}
