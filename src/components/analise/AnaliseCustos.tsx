import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Calculator, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { useAnaliseCustos } from "@/hooks/useAnaliseCustos";

interface AnaliseCustosProps {
  projetoId: string;
  siteId: string;
  periodoInicio: Date;
  periodoFim: Date;
}

export function AnaliseCustos({ projetoId, siteId, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const { custoOrcado, custosErp, fisico, syncErpMock } = useAnaliseCustos(projetoId, siteId, periodoInicio, periodoFim);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const sumErp = (cat: string) => {
    return custosErp.filter(c => c.categoria_interna === cat).reduce((acc, curr) => acc + Number(curr.valor), 0);
  };

  const totalOrca = custoOrcado;

  const rowData = [
    { label: "Mão de Obra", erp: sumErp("Mão de Obra"), fisico: fisico.maoDeObra },
    { label: "Materiais", erp: sumErp("Materiais"), fisico: fisico.materiais },
    { label: "Equipamentos", erp: sumErp("Equipamentos"), fisico: fisico.equipamentos },
    { label: "Transporte", erp: sumErp("Transporte"), fisico: fisico.transporte },
    { label: "Indiretos", erp: sumErp("Indiretos"), fisico: 0 },
    { label: "Financeiros", erp: sumErp("Financeiros"), fisico: 0 }
  ];

  const totalErp = rowData.reduce((acc, r) => acc + r.erp, 0);
  const totalFisico = rowData.reduce((acc, r) => acc + r.fisico, 0);
  const desvioTotalPercent = totalOrca > 0 ? ((totalErp - totalOrca) / totalOrca) * 100 : 0;

  return (
    <div className="space-y-4">
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
              Desvio Geral: 
              <span className={`ml-1 flex items-center font-medium ${desvioTotalPercent > 0 ? "text-destructive" : "text-emerald-500"}`}>
                {desvioTotalPercent > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
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
            <div className="text-2xl font-bold text-primary">{formatCurrency(fisico.total_produzido)}</div>
            {totalErp > fisico.total_produzido && (
               <p className="text-xs font-semibold text-destructive mt-1">Custo superou Métrica de Produção</p>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-center items-center p-4">
          <p className="text-xs text-muted-foreground text-center">Sincronize pelo botão no cabeçalho da página</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle>Matriz de Custos</CardTitle>
          <CardDescription>Custo Orçado (Escopo/BDI) vs Custo Físico vs Gasto Conta Azul</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Categoria de Custo</th>
                <th className="py-3 px-4 font-semibold text-right border-x">Custo Físico (R$)</th>
                <th className="py-3 px-4 font-semibold text-right border-r">Custo ERP (R$)</th>
                <th className="py-3 px-4 font-semibold text-right">Desvio (ERP vs Orçado)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rowData.map((row) => {
                return (
                  <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{row.label}</td>
                    <td className="py-3 px-4 text-right border-x border-muted font-mono">{formatCurrency(row.fisico)}</td>
                    <td className="py-3 px-4 text-right border-r border-muted font-mono font-medium">{formatCurrency(row.erp)}</td>
                    <td className="py-3 px-4 text-right">
                       <span className={row.erp > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                         {row.erp > 0 ? "+" : ""}{formatCurrency(row.erp)}
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-bold border-t-2 border-primary/20">
              <tr>
                <td className="py-3 px-4">TOTAL</td>
                <td className="py-3 px-4 text-right">{formatCurrency(totalFisico)}</td>
                <td className="py-3 px-4 text-right">{formatCurrency(totalErp)}</td>
                <td className="py-3 px-4 text-right text-destructive">
                   {totalErp > totalOrca ? "+" + formatCurrency(totalErp - totalOrca) : formatCurrency(totalErp - totalOrca)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      
    </div>
  );
}
