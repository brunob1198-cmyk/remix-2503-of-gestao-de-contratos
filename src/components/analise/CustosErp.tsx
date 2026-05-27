import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, startOfMonth, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnaliseCustosMulti } from "@/hooks/useAnaliseCustos";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, Download, X, AlertCircle, CheckCircle2, Wand2, GripHorizontal, ChevronRight, ChevronDown } from "lucide-react";
import { ResizableBox } from "react-resizable";
import "react-resizable/css/styles.css";
import * as XLSX from "xlsx";
import { TablePagination } from "@/components/medicoes/TablePagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
  "Direto",
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
  onToggleValues?: (vals: string[], shouldSelect: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isCompetencia?: boolean;
}

function ColumnHeaderFilter({ 
  label, 
  sortDir, 
  onSort, 
  searchText, 
  onSearchChange, 
  uniqueValues, 
  selectedValues, 
  onToggleValue, 
  onSelectAll, 
  onClearAll,
  isCompetencia 
}: ColumnHeaderFilterProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
  const [width, setWidth] = useState(350);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const hierarchicalData = useMemo(() => {
    if (!isCompetencia) return null;
    
    const months: Record<string, { label: string; days: string[] }> = {};
    
    uniqueValues.forEach(val => {
      if (val === "-") return;
      const [day, month, year] = val.split("/");
      const monthKey = `${year}-${month}`;
      const monthLabel = format(new Date(Number(year), Number(month) - 1), "MMMM 'de' yyyy", { locale: ptBR });
      
      if (!months[monthKey]) {
        months[monthKey] = { label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), days: [] };
      }
      months[monthKey].days.push(val);
    });

    // Ordenar meses decrescente
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
  }, [uniqueValues, isCompetencia]);

  const toggleMonth = (monthKey: string) => {
    const next = new Set(expandedMonths);
    if (next.has(monthKey)) next.delete(monthKey);
    else next.add(monthKey);
    setExpandedMonths(next);
  };

  const isMonthSelected = (days: string[]) => days.every(d => selectedValues.has(d));
  const isMonthIndeterminate = (days: string[]) => days.some(d => selectedValues.has(d)) && !isMonthSelected(days);

  const toggleMonthSelection = (days: string[]) => {
    const allSelected = isMonthSelected(days);
    days.forEach(d => {
      if (allSelected) {
        if (selectedValues.has(d)) onToggleValue(d);
      } else {
        if (!selectedValues.has(d)) onToggleValue(d);
      }
    });
  };

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
        <PopoverContent className="p-0 border-none bg-transparent shadow-none w-auto overflow-visible" align="start" sideOffset={8}>
          <ResizableBox
            width={width}
            height={400}
            minConstraints={[280, 250]}
            maxConstraints={[800, 800]}
            axis="both"
            onResize={(e, data) => setWidth(data.size.width)}
            handle={
              <div className="absolute right-0 bottom-0 p-1 cursor-nwse-resize z-50 text-muted-foreground hover:text-primary transition-colors">
                <GripHorizontal className="h-3 w-3 rotate-45" />
              </div>
            }
            className="relative bg-popover border rounded-lg shadow-xl overflow-hidden flex flex-col"
          >
            <div className="p-3 space-y-3 flex flex-col h-full">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder={`Pesquisar ${label.toLowerCase()}...`} 
                  value={searchText} 
                  onChange={(e) => onSearchChange(e.target.value)} 
                  className="h-8 text-sm" 
                />
              </div>
              <div className="flex gap-2 text-xs font-medium">
                <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
                <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {isCompetencia && hierarchicalData ? (
                  hierarchicalData.map(([monthKey, data]) => {
                    const filteredDays = data.days.filter(d => d.toLowerCase().includes(searchText.toLowerCase()));
                    if (filteredDays.length === 0) return null;
                    
                    const isExpanded = expandedMonths.has(monthKey) || searchText !== "";
                    
                    return (
                      <div key={monthKey} className="space-y-1">
                        <div className="flex items-center gap-1 hover:bg-accent rounded px-1 py-1 transition-colors group">
                          <button 
                            onClick={() => toggleMonth(monthKey)}
                            className="p-0.5 hover:bg-muted rounded"
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                          <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleMonthSelection(data.days)}>
                            <Checkbox 
                              checked={isMonthSelected(data.days)}
                              className={cn("h-4 w-4", isMonthIndeterminate(data.days) && "opacity-50")}
                            />
                            <span className="text-sm font-medium">{data.label}</span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="ml-6 space-y-1">
                            {filteredDays.map(day => (
                              <label key={day} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1 transition-colors">
                                <Checkbox 
                                  checked={selectedValues.has(day)} 
                                  onCheckedChange={() => onToggleValue(day)} 
                                  className="h-4 w-4" 
                                />
                                <span className="break-words leading-tight flex-1">{day}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  uniqueValues.filter(v => v.toLowerCase().includes(searchText.toLowerCase())).map(v => (
                    <label key={v} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1.5 transition-colors">
                      <Checkbox 
                        checked={selectedValues.has(v)} 
                        onCheckedChange={() => onToggleValue(v)} 
                        className="h-4 w-4 mt-0.5" 
                      />
                      <span className="break-words leading-tight flex-1">{v || "(vazio)"}</span>
                    </label>
                  ))
                )}
                {isCompetencia && uniqueValues.includes("-") && (
                   <label className="flex items-start gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1.5 transition-colors">
                    <Checkbox 
                      checked={selectedValues.has("-")} 
                      onCheckedChange={() => onToggleValue("-")} 
                      className="h-4 w-4 mt-0.5" 
                    />
                    <span className="break-words leading-tight flex-1">(vazio)</span>
                  </label>
                )}
              </div>
            </div>
          </ResizableBox>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTexts, setSearchTexts] = useState<Record<ColKey, string>>(() => {
    const saved = localStorage.getItem("custos_erp_search_texts");
    return saved ? JSON.parse(saved) : {
      competencia: "", descricao: "", mapeamento: "", centro_custo: "", valor: "", status: "", categoria: ""
    };
  });
  const [selectedFilters, setSelectedFilters] = useState<Record<ColKey, Set<string>>>(() => {
    const saved = localStorage.getItem("custos_erp_selected_filters");
    if (saved) {
      const parsed = JSON.parse(saved);
      const result: any = {};
      Object.keys(parsed).forEach(key => {
        result[key] = new Set(parsed[key]);
      });
      return result;
    }
    return {
      competencia: new Set(), descricao: new Set(), mapeamento: new Set(), centro_custo: new Set(), valor: new Set(), status: new Set(), categoria: new Set()
    };
  });

  useEffect(() => {
    localStorage.setItem("custos_erp_search_texts", JSON.stringify(searchTexts));
  }, [searchTexts]);

  useEffect(() => {
    const toSave: any = {};
    Object.keys(selectedFilters).forEach(key => {
      toSave[key] = Array.from(selectedFilters[key as ColKey]);
    });
    localStorage.setItem("custos_erp_selected_filters", JSON.stringify(toSave));
  }, [selectedFilters]);


  const uniqueValues = useMemo(() => {
    const result: Record<ColKey, string[]> = {} as any;
    
    allCols.forEach(col => {
      // Para cada coluna, as opções disponíveis devem respeitar os filtros das OUTRAS colunas
      let itemsForThisCol = [...custosErp];
      
      allCols.forEach(otherCol => {
        if (col === otherCol) return; // Não filtra a si mesma para permitir trocar a seleção
        
        const search = searchTexts[otherCol].toLowerCase();
        const selected = selectedFilters[otherCol];
        
        if (search) {
          itemsForThisCol = itemsForThisCol.filter(item => 
            getColValue(item, otherCol).toLowerCase().includes(search)
          );
        }
        
        if (selected.size > 0) {
          itemsForThisCol = itemsForThisCol.filter(item => 
            selected.has(getColValue(item, otherCol))
          );
        }
      });

      const vals = Array.from(new Set(itemsForThisCol.map(item => getColValue(item, col))));
      vals.sort();
      result[col] = vals;
    });
    
    return result;
  }, [custosErp, searchTexts, selectedFilters]);


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
            {selectedIds.size > 0 && (
              <Select onValueChange={(val) => {
                const updates = Array.from(selectedIds).map(id => {
                  const item = custosErp.find(c => c.id === id);
                  return {
                    erp_id: item?.erp_id || "",
                    categoria_interna: val,
                    categoria_erp: item?.categoria_erp || ""
                  };
                }).filter(u => u.erp_id);
                
                updateBulkCategorias.mutate(updates, {
                  onSuccess: () => setSelectedIds(new Set())
                });
              }}>
                <SelectTrigger className="h-9 w-[180px] bg-primary text-primary-foreground border-none">
                  <Wand2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={`Alterar ${selectedIds.size} itens`} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PADRAO.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
                  <th className="py-2 px-3 w-10 text-center">
                    <Checkbox 
                      checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedIds.has(item.id))}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        paginatedItems.forEach(item => {
                          if (checked) next.add(item.id);
                          else next.delete(item.id);
                        });
                        setSelectedIds(next);
                      }}
                    />
                  </th>
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
                        isCompetencia={col === "competencia"}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-2 px-3 text-center">
                      <Checkbox 
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(item.id);
                          else next.delete(item.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
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
                  <td className="py-2 px-3 w-10"></td>
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
