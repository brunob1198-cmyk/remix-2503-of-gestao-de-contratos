import { Card, CardContent } from "@/components/ui/card";
import { useSupplyChainCounts, useEconomiaGerada } from "@/hooks/useSupplyChain";
import { ClipboardCheck, FileText, ShoppingCart, Truck, Package, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export function SupplyChainDashboard({
  onFilterChange,
  activeFilter,
}: {
  onFilterChange: (tab: string, filter?: string) => void;
  activeFilter: { tab: string; filter?: string };
}) {
  const { data: stats } = useSupplyChainCounts();
  const { data: economia } = useEconomiaGerada(30);

  const s = stats || {
    requisicoesPendentes: 0,
    emCotacao: 0,
    paraAprovar: 0,
    pedidosEmAberto: 0,
    recebimentosPendentes: 0,
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <DashboardCard
        title="RCs Pendentes"
        value={s.requisicoesPendentes}
        icon={FileText}
        color="bg-blue-500"
        onClick={() => onFilterChange("requisicoes", "pendente")}
        isActive={activeFilter.tab === "requisicoes" && activeFilter.filter === "pendente"}
      />
      <DashboardCard
        title="Em Cotação"
        value={s.emCotacao}
        icon={ClipboardCheck}
        color="bg-orange-500"
        onClick={() => onFilterChange("cotacoes")}
        isActive={activeFilter.tab === "cotacoes" && !activeFilter.filter}
      />
      <DashboardCard
        title="Para Aprovar"
        value={s.paraAprovar}
        icon={ShoppingCart}
        color="bg-purple-500"
        onClick={() => onFilterChange("comparativo")}
        isActive={activeFilter.tab === "comparativo"}
      />
      <DashboardCard
        title="Pedidos Abertos"
        value={s.pedidosEmAberto}
        icon={Truck}
        color="bg-indigo-500"
        onClick={() => onFilterChange("pedidos", "abertos")}
        isActive={activeFilter.tab === "pedidos" && activeFilter.filter === "abertos"}
      />
      <DashboardCard
        title="Para Receber"
        value={s.recebimentosPendentes}
        icon={Package}
        color="bg-green-500"
        onClick={() => onFilterChange("pedidos", "para_receber")}
        isActive={activeFilter.tab === "pedidos" && activeFilter.filter === "para_receber"}
      />
    </div>
  );
}
