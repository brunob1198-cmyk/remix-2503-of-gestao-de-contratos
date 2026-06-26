import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { useTableFilters } from "@/hooks/useTableFilters";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnHeader } from "@/components/medicoes/ColumnHeader";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Settings2, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  projetoId: string;
  selectedSiteIds: string[];
  dataInicio: string;
  dataFim: string;
}

type ColKey =
  | "projeto"
  | "site_codigo"
  | "site_nome"
  | "municipio"
  | "uf"
  | "data"
  | "clima"
  | "status_ativo"
  | "item_codigo"
  | "item_descricao"
  | "unidade"
  | "quantidade"
  | "preco_unitario"
  | "valor_total"
  | "observacoes";

const ALL_COLUMNS: { key: ColKey; label: string; numeric?: boolean; group: string }[] = [
  { key: "projeto", label: "Projeto", group: "Identificação" },
  { key: "site_codigo", label: "Site (Código)", group: "Identificação" },
  { key: "site_nome", label: "Site (Nome)", group: "Identificação" },
  { key: "municipio", label: "Município", group: "Localização" },
  { key: "uf", label: "UF", group: "Localização" },
  { key: "data", label: "Data", group: "Diário" },
  { key: "clima", label: "Clima", group: "Diário" },
  { key: "status_ativo", label: "Status Ativo", group: "Diário" },
  { key: "item_codigo", label: "Item (Código)", group: "Item LPU" },
  { key: "item_descricao", label: "Item (Descrição)", group: "Item LPU" },
  { key: "unidade", label: "Unidade", group: "Item LPU" },
  { key: "quantidade", label: "Quantidade", numeric: true, group: "Valores" },
  { key: "preco_unitario", label: "Preço Unitário", numeric: true, group: "Valores" },
  { key: "valor_total", label: "Valor Total", numeric: true, group: "Valores" },
  { key: "observacoes", label: "Observações", group: "Diário" },
];

const DEFAULT_VISIBLE: ColKey[] = [
  "projeto", "site_codigo", "site_nome", "municipio", "data",
  "item_codigo", "item_descricao", "quantidade", "valor_total",
];

interface Row {
  projeto: string;
  site_codigo: string;
  site_nome: string;
  municipio: string;
  uf: string;
  data: string;
  clima: string;
  status_ativo: string;
  item_codigo: string;
  item_descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  observacoes: string;
}

export default function RelatorioAvancado({ projetoId, selectedSiteIds, dataInicio, dataFim }: Props) {
  const { empresaId } = useAuth();
  const [visibleColumns, setVisibleColumns] = usePersistedState<ColKey[]>(
    "relatorio_avancado_columns",
    DEFAULT_VISIBLE
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["relatorio_avancado", empresaId, projetoId, selectedSiteIds, dataInicio, dataFim],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("diarios_obra")
        .select("id, data, observacoes, clima, status_ativo, municipio, uf, site_id, site:sites!inner(id, codigo, nome, projeto_id, projeto:projetos!inner(id, codigo, empresa_id))");
      if (empresaId) q = q.eq("site.projeto.empresa_id", empresaId);
      if (projetoId) q = q.eq("site.projeto_id", projetoId);
      if (selectedSiteIds.length > 0) q = q.in("site_id", selectedSiteIds);
      if (dataInicio) q = q.gte("data", dataInicio);
      if (dataFim) q = q.lte("data", dataFim);

      const diarios = await fetchAllPages<any>(q);
      if (!diarios.length) return [];

      const ids = diarios.map((d: any) => d.id);
      const prods = await fetchAllPages<any>(
        supabase
          .from("diario_producao")
          .select("diario_id, quantidade, valor_total, preco_unitario_congelado, item_lpu:itens_lpu(codigo, descricao, unidade, preco_unitario)")
          .in("diario_id", ids)
      );

      const dMap = new Map(diarios.map((d: any) => [d.id, d]));
      return (prods || []).map((p: any) => {
        const d: any = dMap.get(p.diario_id) || {};
        const preco = Number(p.preco_unitario_congelado) || Number(p.item_lpu?.preco_unitario) || 0;
        return {
          projeto: d.site?.projeto?.codigo || "",
          site_codigo: d.site?.codigo || "",
          site_nome: d.site?.nome || "",
          municipio: d.municipio || "",
          uf: d.uf || "",
          data: d.data || "",
          clima: d.clima || "",
          status_ativo: d.status_ativo || "",
          item_codigo: p.item_lpu?.codigo || "",
          item_descricao: p.item_lpu?.descricao || "",
          unidade: p.item_lpu?.unidade || "",
          quantidade: Number(p.quantidade) || 0,
          preco_unitario: preco,
          valor_total: Number(p.valor_total) || 0,
          observacoes: d.observacoes || "",
        } as Row;
      });
    },
  });

  const activeColumns = useMemo(
    () => ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)),
    [visibleColumns]
  );
  const activeKeys = useMemo(() => activeColumns.map(c => c.key), [activeColumns]);

  const getColValue = (row: Row, col: ColKey): string => {
    const v = row[col];
    if (typeof v === "number") return String(v);
    return v ?? "";
  };

  const filters = useTableFilters<Row, ColKey>(rows, activeKeys, getColValue, "relatorio_avancado_filters");

  const toggleColumn = (key: ColKey) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExport = () => {
    const data = filters.processedItems.map(r => {
      const obj: Record<string, any> = {};
      activeColumns.forEach(c => {
        obj[c.label] = r[c.key];
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Avançado");
    XLSX.writeFile(wb, `relatorio_avancado_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const formatCell = (col: ColKey, value: any) => {
    if (col === "valor_total" || col === "preco_unitario") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
    }
    if (col === "quantidade") {
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value) || 0);
    }
    if (col === "data" && value) {
      const [y, m, d] = String(value).split("-");
      return `${d}/${m}/${y}`;
    }
    return value ?? "";
  };

  const groupedColumns = useMemo(() => {
    const map = new Map<string, typeof ALL_COLUMNS>();
    ALL_COLUMNS.forEach(c => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <CardTitle>Relatório Avançado (Detalhamento Diário)</CardTitle>
            <CardDescription>
              Monte seu relatório escolhendo quais campos do diário de obra exibir
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configurar Colunas ({visibleColumns.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Campos disponíveis</span>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.key))}
                      className="text-primary hover:underline"
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setVisibleColumns(DEFAULT_VISIBLE)}
                      className="text-primary hover:underline"
                    >
                      Padrão
                    </button>
                  </div>
                </div>
                <ScrollArea className="h-80">
                  <div className="p-2 space-y-3">
                    {groupedColumns.map(([group, cols]) => (
                      <div key={group}>
                        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase">
                          {group}
                        </div>
                        {cols.map(c => (
                          <label
                            key={c.key}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={visibleColumns.includes(c.key)}
                              onCheckedChange={() => toggleColumn(c.key)}
                            />
                            <span>{c.label}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filters.processedItems.length}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
        {filters.hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={filters.clearAllFilters}>
              Limpar filtros
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum dado de diário de obra encontrado para os filtros selecionados
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeColumns.map(c => (
                      <TableHead key={c.key} className={c.numeric ? "text-right" : ""}>
                        <ColumnHeader
                          label={c.label}
                          sortDir={filters.sortColumn === c.key ? filters.sortDir : null}
                          onSort={() => filters.handleSort(c.key)}
                          searchText={filters.searchTexts[c.key] || ""}
                          onSearchChange={v => filters.setSearchText(c.key, v)}
                          uniqueValues={filters.uniqueValues[c.key] || []}
                          selectedValues={filters.selectedFilters[c.key] || new Set()}
                          onToggleValue={v => filters.toggleValue(c.key, v)}
                          onSelectAll={() => filters.selectAll(c.key, filters.uniqueValues[c.key] || [])}
                          onClearAll={() => filters.clearAll(c.key)}
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filters.paginatedItems.map((r, i) => (
                    <TableRow key={i}>
                      {activeColumns.map(c => (
                        <TableCell
                          key={c.key}
                          className={`${c.numeric ? "text-right tabular-nums" : ""} ${c.key === "observacoes" ? "max-w-md whitespace-pre-wrap text-xs text-muted-foreground" : ""}`}
                        >
                          {formatCell(c.key, r[c.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={filters.currentPage}
              totalPages={filters.totalPages}
              itemsPerPage={filters.itemsPerPage}
              totalItems={filters.processedItems.length}
              onPageChange={filters.setCurrentPage}
              onItemsPerPageChange={filters.setItemsPerPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
