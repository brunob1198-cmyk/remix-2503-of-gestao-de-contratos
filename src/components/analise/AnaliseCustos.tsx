import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AnaliseCustosProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

export function AnaliseCustos({ projetoIds, periodoInicio, periodoFim }: AnaliseCustosProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["analise_custos_matrix_mensal", projetoIds, periodoInicio, periodoFim],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("get_analise_custos_matrix", {
        p_projeto_ids: projetoIds,
        p_data_inicio: format(periodoInicio, "yyyy-MM-dd"),
        p_data_fim: format(periodoFim, "yyyy-MM-dd"),
      });
      if (error) throw error;
      return res as any[];
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Custos e Margens</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right bg-blue-50">Receita</TableHead>
                <TableHead className="text-right bg-blue-50">Receita Líquida</TableHead>
                <TableHead className="text-right bg-blue-50">MB R$</TableHead>
                <TableHead className="text-right bg-blue-50">MB %</TableHead>
                <TableHead className="text-right bg-amber-50">Custo Orçado Ger.</TableHead>
                <TableHead className="text-right bg-amber-50">Custo Real Ger.</TableHead>
                <TableHead className="text-right bg-amber-50">% Ger. Orçado</TableHead>
                <TableHead className="text-right bg-amber-50">% Ger. Real</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((row: any) => (
                <TableRow key={row.projeto_id}>
                  <TableCell className="font-medium">{row.projeto_nome}</TableCell>
                  <TableCell className="text-right">{fmt(row.receita)}</TableCell>
                  <TableCell className="text-right">{fmt(row.receita_liquida)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(row.mb_valor)}</TableCell>
                  <TableCell className="text-right">{fmtPct(row.mb_percent)}</TableCell>
                  <TableCell className="text-right">{fmt(row.custo_orcado_gerencia)}</TableCell>
                  <TableCell className="text-right">{fmt(row.custo_real_gerencia)}</TableCell>
                  <TableCell className="text-right">{fmtPct(row.perc_ger_orcado)}</TableCell>
                  <TableCell className="text-right">{fmtPct(row.perc_ger_real)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
