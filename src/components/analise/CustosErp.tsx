import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, Download, X, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CustosErpProps {
  projetoIds: string[];
  periodoInicio: Date;
  periodoFim: Date;
}

const CATEGORIAS_PADRAO = [
  "Mão de Obra",
  "Materiais",
  "Transporte",
  "Equipamentos",
  "Indiretos",
  "Financeiros",
  "Gerência",
];

type ColKey = "competencia" | "descricao" | "mapeamento" | "centro_custo" | "valor" | "status" | "categoria";

const COL_LABELS: Record<ColKey, string> = {
  competencia: "Competência",
  descricao: "Descrição ERP",
  mapeamento: "Mapeamento Original ERP",
  centro_custo: "Centro Custo ERP",
  valor: "Valor R$",
  status: "Status",
  categoria: "Categoria IA/Engenharia",
};

type SortDir = "asc" | "desc" | null;

function getColValue(item: any, col: ColKey): string {
  if (col === "competencia") return item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-";
  if (col === "descricao") return item.descricao || "";
  if (col === "mapeamento") return item.categoria_erp || "";
  if (col === "centro_custo") return item.centro_custo || "";
  if (col === "valor") return item.valor?.toString() || "0";
  if (col === "status") return item.status_erp?.toUpperCase() || "";
  if (col === "categoria") return item.categoria_interna || "";
  return "";
}

interface ColumnHeaderFilterProps {
  label: string;
  sortDir: SortDir;
  onSort: () => void;
  searchText: string;
  onSearchChange: (v: string) => void;
  uniqueValues: string[];
  selectedValues: Set<string>;
  onToggleValue: (v: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

function ColumnHeaderFilter({ label, sortDir, onSort, searchText, onSearchChange, uniqueValues, selectedValues, onToggleValue, onSelectAll, onClearAll }: ColumnHeaderFilterProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div className="flex items-center gap-1">
      <button onClick={onSort} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium text-xs">
        {label}
        <SortIcon className="h-3 w-3" />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`p-0.5 rounded hover:bg-accent transition-colors ${isFiltered ? "text-primary" : "text-muted-foreground"}`}>
            <Filter className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <Input placeholder={`Pesquisar ${label.toLowerCase()}...`} value={searchText} onChange={(e) => onSearchChange(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2 text-xs">
            <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
            <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {uniqueValues.filter(v => v.toLowerCase().includes(searchText.toLowerCase())).map(v => (
              <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                <Checkbox checked={selectedValues.has(v)} onCheckedChange={() => onToggleValue(v)} className="h-3.5 w-3.5" />
                <span className="truncate">{v || "(vazio)"}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CustosErp({ projetoIds, periodoInicio, periodoFim }: CustosErpProps) {
  const { custosErp, loadCustos, updateCategoria, updateBulkCategorias, categoriasMapeamento } = useAnaliseCustosMulti(projetoIds, periodoInicio, periodoFim);

  const allCols: ColKey[] = ["competencia", "descricao", "mapeamento", "centro_custo", "valor", "status", "categoria"];

  const [sortCol, setSortCol] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTexts, setSearchTexts] = useState<Record<ColKey, string>>({
    competencia: "", descricao: "", mapeamento: "", centro_custo: "", valor: "", status: "", categoria: ""
  });
  const [selectedFilters, setSelectedFilters] = useState<Record<ColKey, Set<string>>>({
    competencia: new Set(), descricao: new Set(), mapeamento: new Set(), centro_custo: new Set(), valor: new Set(), status: new Set(), categoria: new Set()
  });


  const uniqueValues = useMemo(() => {
    const result: Record<ColKey, string[]> = {} as any;
    allCols.forEach(col => {
      const vals = Array.from(new Set(custosErp.map(item => getColValue(item, col))));
      vals.sort();
      result[col] = vals;
    });
    return result;
  }, [custosErp]);


  const filteredItems = useMemo(() => {
    let items = [...custosErp];
    
    for (const col of allCols) {
      const search = searchTexts[col].toLowerCase();
      const selected = selectedFilters[col];
      if (search) items = items.filter(item => getColValue(item, col).toLowerCase().includes(search));
      if (selected.size > 0) items = items.filter(item => selected.has(getColValue(item, col)));
    }

    if (sortCol && sortDir) {
      items.sort((a, b) => {
        let va = getColValue(a, sortCol);
        let vb = getColValue(b, sortCol);
        
        if (sortCol === "valor") return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
        
        if (sortCol === "competencia") {
          const dateA = a.data_competencia ? new Date(a.data_competencia).getTime() : 0;
          const dateB = b.data_competencia ? new Date(b.data_competencia).getTime() : 0;
          return sortDir === "asc" ? dateA - dateB : dateB - dateA;
        }

        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return items;
  }, [custosErp, searchTexts, selectedFilters, sortCol, sortDir]);

  const totalValor = useMemo(() => {
    return filteredItems.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }, [filteredItems]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);


  const handleExport = () => {
    const data = filteredItems.map(item => ({
      [COL_LABELS.competencia]: item.data_competencia ? parseISO(item.data_competencia) : null,
      [COL_LABELS.descricao]: item.descricao || "",
      [COL_LABELS.mapeamento]: item.categoria_erp || "",
      [COL_LABELS.centro_custo]: item.centro_custo || "",
      [COL_LABELS.valor]: item.valor || 0,
      [COL_LABELS.status]: item.status_erp?.toUpperCase() || "",
      [COL_LABELS.categoria]: item.categoria_interna || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data, { cellDates: true });

    // Set column format for the date column (first column 'A')
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })]; // Column A is index 0
      if (cell) cell.z = 'dd/mm/yyyy';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria ERP");
    XLSX.writeFile(wb, `auditoria_erp_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Auditoria de Despesas - Conta Azul
            </CardTitle>
            <CardDescription>
              Verificação automática de categorias ERP vs Regras de Mapeamento (DE-PARA).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredItems.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {loadCustos ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {allCols.map(col => (
                    <th key={col} className={`py-2 px-3 ${col === "valor" ? "text-right" : "text-left"}`}>
                      <ColumnHeaderFilter
                        label={COL_LABELS[col]}
                        sortDir={sortCol === col ? sortDir : null}
                        onSort={() => {
                          if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
                          else { setSortCol(col); setSortDir("asc"); }
                        }}
                        searchText={searchTexts[col]}
                        onSearchChange={(v) => setSearchTexts(prev => ({ ...prev, [col]: v }))}
                        uniqueValues={uniqueValues[col]}
                        selectedValues={selectedFilters[col]}
                        onToggleValue={(v) => {
                          const next = new Set(selectedFilters[col]);
                          next.has(v) ? next.delete(v) : next.add(v);
                          setSelectedFilters(prev => ({ ...prev, [col]: next }));
                        }}
                        onSelectAll={() => setSelectedFilters(prev => ({ ...prev, [col]: new Set(uniqueValues[col]) }))}
                        onClearAll={() => setSelectedFilters(prev => ({ ...prev, [col]: new Set() }))}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground">
                      {item.data_competencia ? format(parseISO(item.data_competencia), "dd/MM/yyyy") : "-"}
                    </td>
                    <td className="py-2 px-3 font-medium">{item.descricao}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {item.categoria_erp}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {item.centro_custo ? <Badge variant="outline">{item.centro_custo}</Badge> : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.valor)}</td>
                    <td className="py-2 px-3">
                      <Badge variant={item.status_erp === "pago" ? "secondary" : "outline"}>
                        {item.status_erp?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={item.categoria_interna} 
                          onValueChange={(val) => updateCategoria.mutate({ erpId: item.erp_id, newCategoria: val })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS_PADRAO.map(cat => (
                              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 border-t font-medium">
                <tr>
                  {allCols.map(col => (
                    <td key={`footer-${col}`} className={`py-2 px-3 ${col === "valor" ? "text-right" : "text-left"}`}>
                      {col === "valor" ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Subtotal</span>
                          <span className="text-sm font-mono text-primary font-bold">{formatCurrency(totalValor)}</span>
                        </div>
                      ) : col === "descricao" ? (
                        <span className="text-xs text-muted-foreground">Total de {filteredItems.length} lançamentos</span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
            <TablePagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredItems.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
