import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calculator, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { useAnaliseCustos } from "@/hooks/useAnaliseCustos";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface AnaliseCustosProps {
  projetoId: string;
  siteId: string;
  periodoInicio: Date;
  periodoFim: Date;
}

const CATEGORIAS = [
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Transporte",
  "Indiretos",
  "Financeiros",
];

export function AnaliseCustos({ projetoId, siteId, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const { custoOrcado, valorProduzido, custosErp, fisico, syncErpMock } = useAnaliseCustos(projetoId, siteId, periodoInicio, periodoFim);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const sumErp = (cat: string) =>
    custosErp.filter((c) => c.categoria_interna === cat).reduce((acc, curr) => acc + Number(curr.valor), 0);

  const totalOrca = custoOrcado;
  const categoriaSums = CATEGORIAS.map((cat) => ({ label: cat, value: sumErp(cat) }));
  const totalErp = categoriaSums.reduce((acc, c) => acc + c.value, 0);
  const desvioTotalPercent = totalOrca > 0 ? ((totalErp - totalOrca) / totalOrca) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Orçado</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOrca)}</div>
            <p className="text-xs text-muted-foreground mt-1">Escopo × (Preço / BDI)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Real (ERP)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalErp)}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              Desvio:{" "}
              <span
                className={`ml-1 flex items-center font-medium ${
                  desvioTotalPercent > 0 ? "text-destructive" : "text-emerald-500"
                }`}
              >
                {desvioTotalPercent > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {desvioTotalPercent.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produzido Físico</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(valorProduzido)}</div>
            {totalErp > fisico.total_produzido && (
              <p className="text-xs font-semibold text-destructive mt-1">Custo superou Produção</p>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-center items-center p-4">
          <p className="text-xs text-muted-foreground text-center">Sincronize pelo botão no cabeçalho da página</p>
        </Card>
      </div>

      {/* Tabela pivotada: categorias em colunas */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle>Matriz de Custos</CardTitle>
          <CardDescription>Produção, Custo Orçado, Despesas por Categoria e Total Real (ERP)</CardDescription>
        </CardHeader>
        <ScrollArea className="w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold text-right bg-emerald-50 dark:bg-emerald-950/30 border-r">
                    Produção (R$)
                  </th>
                  <th className="py-3 px-4 font-semibold text-right bg-blue-50 dark:bg-blue-950/30 border-r">
                    Custo Orçado (R$)
                  </th>
                  {CATEGORIAS.map((cat) => (
                    <th key={cat} className="py-3 px-4 font-semibold text-right border-r last:border-r-0">
                      {cat} (R$)
                    </th>
                  ))}
                  <th className="py-3 px-4 font-semibold text-right bg-red-50 dark:bg-red-950/30 border-l-2 border-primary/20">
                    Total Despesas (R$)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 border-r">
                    {formatCurrency(valorProduzido)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 border-r">
                    {formatCurrency(totalOrca)}
                  </td>
                  {categoriaSums.map((cat) => (
                    <td key={cat.label} className="py-3 px-4 text-right font-mono border-r last:border-r-0">
                      {formatCurrency(cat.value)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono font-bold text-destructive bg-red-50/50 dark:bg-red-950/10 border-l-2 border-primary/20">
                    {formatCurrency(totalErp)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>
    </div>
  );
}
