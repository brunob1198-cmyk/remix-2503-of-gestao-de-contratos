import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addMonths, startOfMonth, isAfter, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { pickForecastValue } from "@/lib/forecastValue";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const ForecastPublic = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: forecastData, error } = await supabase.rpc('fetch_public_forecast');
        if (error) throw error;
        setData(forecastData || []);
      } catch (error) {
        console.error("Error fetching forecast:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const startDate = subMonths(startOfMonth(new Date()), 18);
  const endDate = addMonths(startOfMonth(new Date()), 5);
  const today = startOfMonth(new Date());

  const columns = React.useMemo(() => {
    const cols = [];
    let current = startDate;
    let safetyCounter = 0;
    while (!isAfter(current, endDate) && safetyCounter < 100) {
      cols.push({
        key: format(current, "yyyy-MM"),
        label: format(current, "MMM/yy", { locale: ptBR }),
        isFuture: isAfter(current, today) || format(current, "yyyy-MM") === format(today, "yyyy-MM"),
      });
      current = addMonths(current, 1);
      safetyCounter++;
    }
    return cols;
  }, [today]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground text-lg">Carregando dados para o Power BI...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-0">
      <Card className="border-none shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold">Relatório de Forecast - Exportação Power BI</CardTitle>
          <p className="text-sm text-muted-foreground">Dados extraídos em: {new Date().toLocaleString('pt-BR')}</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="min-w-[150px] font-bold">Área</TableHead>
                  <TableHead className="min-w-[200px] font-bold">Projeto</TableHead>
                  <TableHead className="min-w-[180px] font-bold">Cliente</TableHead>
                  <TableHead className="min-w-[120px] font-bold">Status</TableHead>
                  <TableHead className="min-w-[120px] text-right font-bold">Vlr Contrato</TableHead>
                  <TableHead className="min-w-[120px] text-right font-bold">Exec Total</TableHead>
                  <TableHead className="min-w-[120px] text-right font-bold">Saldo</TableHead>
                  {columns.map((col) => (
                    <TableHead key={col.key} className={`min-w-[110px] text-center font-bold ${col.isFuture ? "text-blue-600" : ""}`}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => {
                  const saldo = Math.max(0, Number(p.valor_contrato || 0) - Number(p.total_produzido || 0));
                  return (
                    <TableRow key={p.projeto_id}>
                      <TableCell className="font-medium">{p.area_nome || "-"}</TableCell>
                      <TableCell className="font-medium">{p.projeto_nome}</TableCell>
                      <TableCell>{p.cliente_nome || "-"}</TableCell>
                      <TableCell>{p.projeto_status}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.valor_contrato)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(p.total_produzido)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(saldo)}</TableCell>
                      {columns.map((col) => {
                        const projLike = { mensal: p.producao_mensal, forecast_data: p.forecast_data };
                        const val = pickForecastValue(projLike, col);
                        return (
                          <TableCell key={col.key} className={`text-center ${col.isFuture ? "bg-blue-50/30 font-medium" : ""}`}>
                            {val > 0 ? formatCurrency(val) : "-"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForecastPublic;
