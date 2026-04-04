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
  const { orcamentos, custosErp, fisico, saveOrcamento, syncErpMock } = useAnaliseCustos(projetoId, siteId, periodoInicio, periodoFim);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Somando os Lançamentos do ERP por Categoria (Mesma competência)
  const sumErp = (cat: string) => {
    return custosErp.filter(c => c.categoria_interna === cat).reduce((acc, curr) => acc + Number(curr.valor), 0);
  };

  const orc = orcamentos.length > 0 ? orcamentos[0] : null;

  const rowData = [
    { label: "Mão de Obra", erp: sumErp("Mão de Obra"), orca: Number(orc?.mao_de_obra || 0), fisico: fisico.maoDeObra },
    { label: "Materiais", erp: sumErp("Materiais"), orca: Number(orc?.materiais || 0), fisico: fisico.materiais },
    { label: "Equipamentos", erp: sumErp("Equipamentos"), orca: Number(orc?.equipamentos || 0), fisico: fisico.equipamentos },
    { label: "Transporte", erp: sumErp("Transporte"), orca: Number(orc?.transporte || 0), fisico: fisico.transporte },
    { label: "Indiretos", erp: sumErp("Indiretos"), orca: Number(orc?.indiretos || 0), fisico: 0 },
    { label: "Financeiros", erp: sumErp("Financeiros"), orca: Number(orc?.financeiros || 0), fisico: 0 }
  ];

  const totalErp = rowData.reduce((acc, r) => acc + r.erp, 0);
  const totalOrca = rowData.reduce((acc, r) => acc + r.orca, 0);
  const totalFisico = rowData.reduce((acc, r) => acc + r.fisico, 0);
  const desvioTotalPercent = totalOrca > 0 ? ((totalErp - totalOrca) / totalOrca) * 100 : 0;

  const [editMode, setEditMode] = useState(false);
  const [editOrc, setEditOrc] = useState<Record<string, number>>({});

  const handleEditClick = () => {
    setEditMode(true);
    setEditOrc({
      mao_de_obra: Number(orc?.mao_de_obra || 0),
      materiais: Number(orc?.materiais || 0),
      equipamentos: Number(orc?.equipamentos || 0),
      transporte: Number(orc?.transporte || 0),
      indiretos: Number(orc?.indiretos || 0),
      financeiros: Number(orc?.financeiros || 0)
    });
  };

  const handleSaveOrcamento = async () => {
    await saveOrcamento.mutateAsync({
      projeto_id: projetoId,
      site_id: siteId,
      mes_referencia: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).toISOString(),
      ...editOrc
    });
    setEditMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Orçado</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOrca)}</div>
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
              <span className={`ml-1 flex items-center font-medium ${desvioTotalPercent > 0 ? "text-red-500" : "text-emerald-500"}`}>
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
               <p className="text-xs font-semibold text-red-500 mt-1">Custo superou Métrica de Produção</p>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-center gap-3 p-4">
          <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => syncErpMock.mutate()} disabled={syncErpMock.isPending}>
             <RefreshCw className={`h-3 w-3 ${syncErpMock.isPending ? "animate-spin" : ""}`} />
             Sincronizar Conta Azul
          </Button>


        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle>Matriz de Custos</CardTitle>
            <CardDescription>Previsto (Orçamento) vs Custo Físico vs Gasto Conta Azul</CardDescription>
          </div>
          <div>
            {editMode ? (
              <div className="flex gap-2">
                 <Button variant="outline" onClick={() => setEditMode(false)} size="sm">Cancelar</Button>
                 <Button onClick={handleSaveOrcamento} size="sm">Salvar Orçamento</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={handleEditClick} size="sm">Definir Orçamento Base</Button>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Categoria de Custo</th>
                <th className="py-3 px-4 font-semibold text-right border-x">1. Previsto (R$)</th>
                <th className="py-3 px-4 font-semibold text-right border-x">2. Custo Físico (R$)</th>
                <th className="py-3 px-4 font-semibold text-right border-r">3. Custo ERP (R$)</th>
                <th className="py-3 px-4 font-semibold text-right">Desvio (ERP vs Prev)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rowData.map((row) => {
                const desvioAbs = row.erp - row.orca;
                const desvioPct = row.orca > 0 ? (desvioAbs / row.orca) * 100 : 0;
                const estourou = desvioAbs > 0;
                
                return (
                  <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{row.label}</td>
                    
                    <td className="py-3 px-4 text-right border-x border-muted">
                        {editMode ? (
                          <Input 
                            type="number" 
                            className="w-24 ml-auto h-8 text-right"
                            value={editOrc[row.label.toLowerCase().replace(/ /g, "_")] || ""}
                            onChange={(e) => setEditOrc({...editOrc, [row.label.toLowerCase().replace(/ /g, "_")]: Number(e.target.value)})}
                          />
                        ) : (
                          <span className={row.orca === 0 ? "text-muted-foreground" : ""}>
                             {formatCurrency(row.orca)}
                          </span>
                        )}
                    </td>

                    <td className="py-3 px-4 text-right border-x border-muted font-mono">{formatCurrency(row.fisico)}</td>
                    <td className="py-3 px-4 text-right border-r border-muted font-mono font-medium">{formatCurrency(row.erp)}</td>
                    
                    <td className="py-3 px-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <span className={estourou ? "text-red-500 font-semibold" : "text-emerald-500"}>
                           {desvioAbs > 0 ? "+" : ""}{formatCurrency(desvioAbs)}
                         </span>
                         {row.orca > 0 && (
                           <Badge variant={estourou ? "destructive" : "secondary"} className="text-[10px] w-14 justify-center">
                             {desvioPct > 0 ? "+" : ""}{desvioPct.toFixed(0)}%
                           </Badge>
                         )}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-bold border-t-2 border-primary/20">
              <tr>
                <td className="py-3 px-4">TOTAL</td>
                <td className="py-3 px-4 text-right">{formatCurrency(totalOrca)}</td>
                <td className="py-3 px-4 text-right">{formatCurrency(totalFisico)}</td>
                <td className="py-3 px-4 text-right">{formatCurrency(totalErp)}</td>
                <td className="py-3 px-4 text-right text-red-500">
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
