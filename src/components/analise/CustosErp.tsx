import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnaliseCustos } from "@/hooks/useAnaliseCustos";

interface CustosErpProps {
  projetoId: string;
  siteId: string;
}

const CATEGORIAS_ENG = ["Mão de Obra", "Materiais", "Equipamentos", "Transporte", "Indiretos", "Financeiros"];

export function CustosErp({ projetoId, siteId }: CustosErpProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  const { custosErp, updateCategoria } = useAnaliseCustos(projetoId, siteId, selectedMonth);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Auditoria de Despesas - Conta Azul</CardTitle>
        <CardDescription>
          Visualize e re-categorize as despesas vinculadas a esta Obra e Site (Centro de Custo). A Inteligência Artificial já tentou categorizar os itens iniciais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {custosErp.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-md">
            Nenhuma despesa ou pagamento ERP encontrado para este mês ou site.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 text-left w-32">Competência</th>
                  <th className="py-2 px-3 text-left">Descrição ERP</th>
                  <th className="py-2 px-3 text-left">Mapeamento Original ERP</th>
                  <th className="py-2 px-3 text-left">Centro Custo ERP</th>
                  <th className="py-2 px-3 text-right">Valor R$</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center w-48">Categoria IA/Engenharia</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {custosErp.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="py-2 px-3 text-muted-foreground">
                       {item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-"}
                    </td>
                    <td className="py-2 px-3 font-medium">{item.descricao}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{item.categoria_erp}</td>
                    <td className="py-2 px-3 text-xs">
                       {item.centro_custo ? (
                         <Badge variant="outline" className="bg-primary/5">{item.centro_custo}</Badge>
                       ) : (
                         <span className="text-muted-foreground italic">Sem vínculo</span>
                       )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.valor)}</td>
                    <td className="py-2 px-3 text-center">
                       <Badge variant={item.status_erp === "pago" ? "secondary" : "outline"} className={item.status_erp === "pago" ? "bg-emerald-500/10 text-emerald-600" : ""}>
                         {item.status_erp?.toUpperCase()}
                       </Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                       <Select 
                         value={item.categoria_interna} 
                         onValueChange={(val) => updateCategoria.mutate({ erpId: item.erp_id, newCategoria: val })}
                       >
                         <SelectTrigger className="h-7 text-xs">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           {CATEGORIAS_ENG.map(cat => (
                             <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
