import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useContratos } from "@/hooks/useContratos";
import { useClientes } from "@/hooks/useClientes";
import { useAreas } from "@/hooks/useAreas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDown } from "lucide-react";
import { MonthRangePicker } from "@/components/analise/MonthRangePicker";
import { format, subMonths } from "date-fns";
import * as XLSX from "xlsx";

interface DiarioProducaoRow {
  valor_total: number;
  diarios_obra: {
    data: string;
    site_id: string;
    sites: {
      id: string;
      codigo: string;
      nome: string;
      projeto_id: string;
    };
  };
}

interface MonthlyRow {
  area: string;
  cliente: string;
  projeto_codigo: string;
  projeto_descricao: string;
  coordenador: string;
  valor_contrato: number;
  producao_acum_anterior: number;
  producao_mes: number;
  producao_total_atual: number;
  mes_producao: string; // YYYY-MM
  mes_label: string;
}

export default function ProducaoMensal() {
  const [filtroProjetoId, setFiltroProjetoId] = useState<string>("");
  const [periodoInicio, setPeriodoInicio] = useState<Date>(() => subMonths(new Date(), 2));
  const [periodoFim, setPeriodoFim] = useState<Date>(() => new Date());

  const { projetos } = useProjetos();
  const { contratos } = useContratos();
  const { clientes } = useClientes();
  const { areas } = useAreas();

  const periodoInicioKey = format(periodoInicio, "yyyy-MM");
  const periodoFimKey = format(periodoFim, "yyyy-MM");

  // Fetch all diario_producao with diarios_obra → sites join
  const { data: producaoData = [], isLoading } = useQuery({
    queryKey: ["producao_mensal_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diario_producao")
        .select("valor_total, diarios_obra!inner(data, site_id, sites:sites!inner(id, codigo, nome, projeto_id))")
        .order("diarios_obra(data)", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DiarioProducaoRow[];
    },
  });

  const rows = useMemo(() => {
    // Group by projeto_id + month
    const projetoMonthMap = new Map<string, number>();
    // Also collect all months per project
    const projetoMonths = new Map<string, Set<string>>();

    producaoData.forEach((p) => {
      const diario = p.diarios_obra;
      if (!diario?.sites) return;
      const projetoId = diario.sites.projeto_id;
      const month = diario.data.substring(0, 7); // YYYY-MM
      const key = `${projetoId}|${month}`;
      projetoMonthMap.set(key, (projetoMonthMap.get(key) || 0) + Number(p.valor_total));

      if (!projetoMonths.has(projetoId)) projetoMonths.set(projetoId, new Set());
      projetoMonths.get(projetoId)!.add(month);
    });

    const result: MonthlyRow[] = [];

    const projetosToShow = filtroProjetoId
      ? projetos.filter((p) => p.id === filtroProjetoId)
      : projetos;

    projetosToShow.forEach((projeto) => {
      const months = projetoMonths.get(projeto.id);
      if (!months || months.size === 0) return;

      const sortedMonths = Array.from(months).sort();
      const areaObj = areas.find((a) => a.id === (projeto as any).area_id);
      const clienteObj = projeto.clienteObj || clientes.find((c) => c.id === projeto.cliente_id);
      const contratoObj = projeto.contratoObj || contratos.find((c) => c.id === projeto.contrato_id);

      let acumulado = 0;

      sortedMonths.forEach((month) => {
        const key = `${projeto.id}|${month}`;
        const producaoMes = projetoMonthMap.get(key) || 0;

        // Accumulate everything, but only include rows within the period filter
        if (month < periodoInicioKey) {
          acumulado += producaoMes;
          return;
        }
        if (month > periodoFimKey) return;

        const [year, m] = month.split("-");
        const mesLabel = `${monthNames[parseInt(m, 10) - 1]}-${year.substring(2)}`;

        result.push({
          area: areaObj?.nome || "-",
          cliente: clienteObj?.razao_social || projeto.cliente || "-",
          projeto_codigo: projeto.codigo,
          projeto_descricao: projeto.nome,
          coordenador: projeto.coordenador || "-",
          valor_contrato: Number(contratoObj?.valor_total || projeto.valor_total || 0),
          producao_acum_anterior: acumulado,
          producao_mes: producaoMes,
          producao_total_atual: acumulado + producaoMes,
          mes_producao: month,
          mes_label: mesLabel,
        });

        acumulado += producaoMes;
      });
    });

    return result;
  }, [producaoData, projetos, contratos, clientes, areas, filtroProjetoId, periodoInicioKey, periodoFimKey]);

  const totals = useMemo(
    () => ({
      valor_contrato: rows.reduce((s, r) => s + r.valor_contrato, 0),
      producao_mes: rows.reduce((s, r) => s + r.producao_mes, 0),
      producao_total_atual: rows.length > 0 ? rows[rows.length - 1]?.producao_total_atual || 0 : 0,
    }),
    [rows]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Área: r.area,
        Cliente: r.cliente,
        Projeto: r.projeto_codigo,
        "Descrição do Projeto": r.projeto_descricao,
        Coordenador: r.coordenador,
        "Vlr Total Contrato": r.valor_contrato,
        "Produção Acum. Anterior": r.producao_acum_anterior,
        "Produção do Mês": r.producao_mes,
        "Produção Total Atual": r.producao_total_atual,
        "Mês de Produção": r.mes_label,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção Mensal");
    XLSX.writeFile(wb, `producao_mensal_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <CardTitle>Produção Mensal por Projeto</CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
              <MonthRangePicker
                startDate={periodoInicio}
                endDate={periodoFim}
                onChangeStart={setPeriodoInicio}
                onChangeEnd={setPeriodoFim}
              />
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Projeto</Label>
                <Select
                  value={filtroProjetoId || "all"}
                  onValueChange={(v) => setFiltroProjetoId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {rows.length > 0 && (
                <Button variant="outline" onClick={handleExport}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma produção registrada no período selecionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Área</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Descrição do Projeto</TableHead>
                    <TableHead>Coordenador</TableHead>
                    <TableHead className="text-right">Vlr Contrato</TableHead>
                    <TableHead className="text-right">Prod. Acum. Anterior</TableHead>
                    <TableHead className="text-right">Produção do Mês</TableHead>
                    <TableHead className="text-right">Prod. Total Atual</TableHead>
                    <TableHead>Mês de Produção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.area}</TableCell>
                      <TableCell>{row.cliente}</TableCell>
                      <TableCell className="font-medium">{row.projeto_codigo}</TableCell>
                      <TableCell>{row.projeto_descricao}</TableCell>
                      <TableCell>{row.coordenador}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.valor_contrato)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.producao_acum_anterior)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(row.producao_mes)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.producao_total_atual)}
                      </TableCell>
                      <TableCell>{row.mes_label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={7} className="text-right">TOTAL:</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.producao_mes)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const monthNames = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
