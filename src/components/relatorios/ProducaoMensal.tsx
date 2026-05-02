import { useMemo, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
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
import { useTableFilters } from "@/hooks/useTableFilters";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";

interface DiarioProducaoRow {
  id: string;
  data_producao: string;
  projeto_id: string;
  projeto_codigo: string;
  projeto_nome: string;
  valor_total: number;
  area_nome: string;
  origem: string;
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
  mes_producao: string;
  mes_label: string;
}

const COLUMNS = [
  "area", "cliente", "projeto_codigo", "projeto_descricao",
  "coordenador", "valor_contrato", "producao_acum_anterior",
  "producao_mes", "producao_total_atual", "mes_label",
] as const;

type ColKey = (typeof COLUMNS)[number];

const COL_LABELS: Record<ColKey, string> = {
  area: "Área",
  cliente: "Cliente",
  projeto_codigo: "Projeto",
  projeto_descricao: "Descrição do Projeto",
  coordenador: "Coordenador",
  valor_contrato: "Vlr Contrato",
  producao_acum_anterior: "Prod. Acum. Anterior",
  producao_mes: "Produção do Mês",
  producao_total_atual: "Prod. Total Atual",
  mes_label: "Mês de Produção",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const getColValue = (row: MonthlyRow, col: ColKey): string => {
  const v = row[col];
  if (typeof v === "number") return formatCurrency(v);
  return String(v ?? "");
};

export default function ProducaoMensal() {
  const [filtroProjetoId, setFiltroProjetoId] = usePersistedState<string>("relatorios:producao_mensal:projeto", "");
  const [periodoInicioStr, setPeriodoInicioStr] = usePersistedState<string>(
    "relatorios:producao_mensal:periodo_inicio",
    format(subMonths(new Date(), 2), "yyyy-MM-dd")
  );
  const [periodoFimStr, setPeriodoFimStr] = usePersistedState<string>(
    "relatorios:producao_mensal:periodo_fim",
    format(new Date(), "yyyy-MM-dd")
  );
  const periodoInicio = useMemo(() => new Date(periodoInicioStr + "T00:00:00"), [periodoInicioStr]);
  const periodoFim = useMemo(() => new Date(periodoFimStr + "T00:00:00"), [periodoFimStr]);
  const setPeriodoInicio = useCallback((d: Date) => setPeriodoInicioStr(format(d, "yyyy-MM-dd")), [setPeriodoInicioStr]);
  const setPeriodoFim = useCallback((d: Date) => setPeriodoFimStr(format(d, "yyyy-MM-dd")), [setPeriodoFimStr]);

  const { projetos } = useProjetos();
  const { contratos } = useContratos();
  const { clientes } = useClientes();
  const { areas } = useAreas();

  const periodoInicioKey = format(periodoInicio, "yyyy-MM");
  const periodoFimKey = format(periodoFim, "yyyy-MM");

  const { data: producaoData = [], isLoading } = useQuery({
    queryKey: ["producao_mensal_report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_bi_producao")
        .select("id, data_producao, projeto_id, projeto_codigo, projeto_nome, valor_total, area_nome, origem")
        .limit(100000)
        .order("data_producao", { ascending: true });
      if (error) throw error;
      return (data || []) as DiarioProducaoRow[];
    },
  });

  const rows = useMemo(() => {
    // 1. Agrupar produção por projeto e mês
    const projetoMonthMap = new Map<string, number>();
    const projetoSet = new Set<string>();

    producaoData.forEach((p) => {
      const projetoId = p.projeto_id;
      const month = p.data_producao.substring(0, 7); // "YYYY-MM"
      const key = `${projetoId}|${month}`;
      projetoMonthMap.set(key, (projetoMonthMap.get(key) || 0) + Number(p.valor_total));
      projetoSet.add(projetoId);
    });

    const result: MonthlyRow[] = [];
    const projetosToShow = filtroProjetoId
      ? projetos.filter((p) => p.id === filtroProjetoId)
      : projetos;

    projetosToShow.forEach((projeto) => {
      // Se não tem nenhuma produção histórica na view, não mostramos nada para esse projeto
      if (!projetoSet.has(projeto.id)) return;

      // Pegar todos os meses que tiveram produção para este projeto
      const monthsForThisProject = Array.from(projetoMonthMap.keys())
        .filter(k => k.startsWith(projeto.id + "|"))
        .map(k => k.split("|")[1])
        .sort();

      const areaObj = areas.find((a) => a.id === (projeto as any).area_id);
      const areaName = areaObj?.nome || producaoData.find(p => p.projeto_id === projeto.id)?.area_nome || "-";
      const clienteObj = projeto.clienteObj || clientes.find((c) => c.id === projeto.cliente_id);
      const contratoObj = projeto.contratoObj || contratos.find((c) => c.id === projeto.contrato_id);

      let acumuladoAnterior = 0;

      monthsForThisProject.forEach((month) => {
        const key = `${projeto.id}|${month}`;
        const producaoMes = projetoMonthMap.get(key) || 0;

        // Se o mês for anterior ao início do filtro, soma no acumulado e continua
        if (month < periodoInicioKey) {
          acumuladoAnterior += producaoMes;
          return;
        }

        // Se o mês for posterior ao fim do filtro, para de processar esse projeto
        if (month > periodoFimKey) return;

        const [year, m] = month.split("-");
        const mesLabel = `${monthNames[parseInt(m, 10) - 1]}-${year.substring(2)}`;

        result.push({
          area: areaName,
          cliente: clienteObj?.razao_social || projeto.cliente || "-",
          projeto_codigo: projeto.codigo,
          projeto_descricao: projeto.nome,
          coordenador: projeto.coordenador || "-",
          valor_contrato: Number(contratoObj?.valor_total || projeto.valor_total || 0),
          producao_acum_anterior: acumuladoAnterior,
          producao_mes: producaoMes,
          producao_total_atual: acumuladoAnterior + producaoMes,
          mes_producao: month,
          mes_label: mesLabel,
        });

        // Atualiza o acumulado para o próximo mês do loop
        acumuladoAnterior += producaoMes;
      });
    });

    return result;
  }, [producaoData, projetos, contratos, clientes, areas, filtroProjetoId, periodoInicioKey, periodoFimKey]);

  const {
    sortColumn, sortDir, searchTexts, selectedFilters,
    handleSort, setSearchText, toggleValue, selectAll, clearAll,
    processedItems, uniqueValues,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, paginatedItems,
  } = useTableFilters<MonthlyRow, ColKey>(rows, COLUMNS, getColValue);

  const totals = useMemo(
    () => ({
      producao_mes: processedItems.reduce((s, r) => s + r.producao_mes, 0),
    }),
    [processedItems]
  );

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(
      processedItems.map((r) => ({
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

  const renderColumnHeader = (col: ColKey) => (
    <ColumnHeader
      label={COL_LABELS[col]}
      sortDir={sortColumn === col ? sortDir : null}
      onSort={() => handleSort(col)}
      searchText={searchTexts[col]}
      onSearchChange={(v) => setSearchText(col, v)}
      uniqueValues={uniqueValues[col] || []}
      selectedValues={selectedFilters[col] || new Set()}
      onToggleValue={(v) => toggleValue(col, v)}
      onSelectAll={() => selectAll(col, uniqueValues[col] || [])}
      onClearAll={() => clearAll(col)}
    />
  );

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
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{renderColumnHeader("area")}</TableHead>
                      <TableHead>{renderColumnHeader("cliente")}</TableHead>
                      <TableHead>{renderColumnHeader("projeto_codigo")}</TableHead>
                      <TableHead>{renderColumnHeader("projeto_descricao")}</TableHead>
                      <TableHead>{renderColumnHeader("coordenador")}</TableHead>
                      <TableHead className="text-right">{renderColumnHeader("valor_contrato")}</TableHead>
                      <TableHead className="text-right">{renderColumnHeader("producao_acum_anterior")}</TableHead>
                      <TableHead className="text-right">{renderColumnHeader("producao_mes")}</TableHead>
                      <TableHead className="text-right">{renderColumnHeader("producao_total_atual")}</TableHead>
                      <TableHead>{renderColumnHeader("mes_label")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((row, i) => (
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
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
                totalItems={processedItems.length}
              />
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
