import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

interface DashboardCardsProps {
  totais: {
    totalProduzido: number;
    totalMedido: number;
    totalFaturado: number;
    totalAMedir: number;
    totalAFaturar: number;
  };
}

export function DashboardCards({ totais }: DashboardCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Produzido</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totais.totalProduzido)}
          </div>
          <p className="text-xs text-muted-foreground">Valor total da produção</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Medido</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totais.totalMedido)}
          </div>
          <p className="text-xs text-muted-foreground">Aprovado pelo cliente</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
          <DollarSign className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(totais.totalFaturado)}
          </div>
          <p className="text-xs text-muted-foreground">Notas emitidas</p>
        </CardContent>
      </Card>

      <Card className={totais.totalAMedir > 0 ? "border-orange-300 bg-orange-50" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">A Medir</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(totais.totalAMedir)}
          </div>
          <p className="text-xs text-muted-foreground">Produzido não medido</p>
        </CardContent>
      </Card>

      <Card className={totais.totalAFaturar > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">A Faturar</CardTitle>
          <TrendingDown className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(totais.totalAFaturar)}
          </div>
          <p className="text-xs text-muted-foreground">Medido não faturado</p>
        </CardContent>
      </Card>
    </div>
  );
}
