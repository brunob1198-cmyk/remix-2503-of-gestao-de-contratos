import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForecast } from "@/hooks/useForecast";
import { format, addMonths, startOfMonth, isAfter, subMonths, setYear, setMonth, getYear, getMonth, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, TrendingUp, Calculator, Calendar, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);



export default function ForecastTab() {
  const { data, isLoading, updateForecast } = useForecast();
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ id: string; month: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Filters
  const [selectedObras, setSelectedObras] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(subMonths(startOfMonth(new Date()), 18));
  const [endDate, setEndDate] = useState(addMonths(startOfMonth(new Date()), 5));

  const today = startOfMonth(new Date());
  
  const columns = useMemo(() => {
    const cols = [];
    let current = startDate;
    // Limit to safety to avoid infinite loops if dates are misconfigured
    let safetyCounter = 0;
    while (!isAfter(current, endDate) && safetyCounter < 100) {
      cols.push({
        key: format(current, "yyyy-MM"),
        label: format(current, "MMM/yy", { locale: ptBR }),
        isFuture: isAfter(current, today) || format(current, "yyyy-MM") === format(today, "yyyy-MM"),
        date: current
      });
      current = addMonths(current, 1);
      safetyCounter++;
    }
    return cols;
  }, [startDate, endDate, today]);

  const filteredData = useMemo(() => {
    return data.filter(p => {
      const matchObra = selectedObras.length === 0 || selectedObras.includes(p.nome);
      const matchArea = selectedAreas.length === 0 || (p.areaObj?.nome && selectedAreas.includes(p.areaObj.nome));
      const matchCliente = selectedClientes.length === 0 || 
        selectedClientes.includes(p.clienteObj?.razao_social || p.cliente || "Sem Cliente");
      const matchStatus = selectedStatus.length === 0 || selectedStatus.includes(p.status);
      
      return matchObra && matchArea && matchCliente && matchStatus;
    });
  }, [data, selectedObras, selectedAreas, selectedClientes, selectedStatus]);

  const uniqueAreas = useMemo(() => Array.from(new Set(data.map(p => p.areaObj?.nome).filter(Boolean))) as string[], [data]);
  const uniqueObras = useMemo(() => Array.from(new Set(data.map(p => p.nome))).sort(), [data]);
  const uniqueClientes = useMemo(() => Array.from(new Set(data.map(p => p.clienteObj?.razao_social || p.cliente || "Sem Cliente"))), [data]);
  const uniqueStatus = useMemo(() => Array.from(new Set(data.map(p => p.status))), [data]);

  const handleEdit = (projetoId: string, month: string, currentValue: number) => {
    setEditing({ id: projetoId, month });
    setEditValue(currentValue ? currentValue.toString() : "");
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const val = parseFloat(editValue.replace(",", ".")) || 0;
      await updateForecast(editing.id, editing.month, val);
      setEditing(null);
      toast({ title: "Previsão atualizada!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportData = data.map((p) => {
      const row: any = {
        Área: p.areaObj?.nome || "-",
        Obra: p.nome,
        Cliente: p.clienteObj?.razao_social || p.cliente || "-",
        Status: p.status,
        "Valor Contrato": p.valor_total,
        "Execução Total": p.totalProduzido,
        Saldo: p.saldo,
      };
      columns.forEach((col) => {
        row[col.label] = (p.mensal[col.key] || 0) + (p.forecast[col.key] || 0);
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Forecast");
    XLSX.writeFile(wb, `forecast_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // Cards logic
  const stats = useMemo(() => {
    const totalContrato = filteredData.reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
    const totalProduzido = filteredData.reduce((acc, p) => acc + p.totalProduzido, 0);
    const totalSaldo = filteredData.reduce((acc, p) => acc + p.saldo, 0);

    // Trimestral (Próximos 3 meses)
    const next3Months = columns.filter(c => c.isFuture).slice(0, 3).map(c => c.key);
    const totalTrimestre = filteredData.reduce((acc, p) => {
      let sum = 0;
      next3Months.forEach(m => sum += (p.forecast[m] || 0));
      return acc + sum;
    }, 0);

    // Anual (Restante do ano atual)
    const currentYear = format(new Date(), "yyyy");
    const totalAno = filteredData.reduce((acc, p) => {
      let sum = 0;
      Object.entries(p.forecast).forEach(([m, val]) => {
        if (m.startsWith(currentYear)) sum += (val as number);
      });
      return acc + sum;
    }, 0);

    const columnTotals = columns.reduce((acc, col) => {
      acc[col.key] = filteredData.reduce((sum, p) => {
        return sum + (p.mensal[col.key] || 0) + (p.forecast[col.key] || 0);
      }, 0);
      return acc;
    }, {} as Record<string, number>);

    return { totalContrato, totalProduzido, totalSaldo, totalTrimestre, totalAno, columnTotals };
  }, [filteredData, columns]);

  if (isLoading) return <div className="p-8 text-center">Carregando dados de forecast...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contrato Total</CardTitle>
            <Calculator className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalContrato)}</div>
            <p className="text-xs text-muted-foreground">Soma de todos os projetos</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalProduzido)}</div>
            <p className="text-xs text-muted-foreground">{((stats.totalProduzido / stats.totalContrato) * 100 || 0).toFixed(1)}% do total</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Trimestre</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalTrimestre)}</div>
            <p className="text-xs text-muted-foreground">Previsão próximos 3 meses</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Anual</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalAno)}</div>
            <p className="text-xs text-muted-foreground">Previsão total ano {format(new Date(), "yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <MonthRangePicker 
                startDate={startDate} 
                endDate={endDate} 
                onSelect={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }} 
              />
              <div>
                <CardTitle>Acompanhamento e Forecast</CardTitle>
                <p className="text-sm text-muted-foreground">Meses em <span className="text-blue-600 font-semibold">azul</span> são projeções futuras.</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleExport} size="sm" className="h-9">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[140px] sticky left-0 bg-muted/50 z-20">
                    <div className="flex items-center justify-between">
                      <span>Área</span>
                      <MultiSelectFilter 
                        options={uniqueAreas} 
                        selected={selectedAreas} 
                        onSelect={setSelectedAreas} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px] sticky left-[140px] bg-muted/50 z-20">
                    <div className="flex items-center justify-between">
                      <span>Obra</span>
                      <MultiSelectFilter 
                        options={uniqueObras} 
                        selected={selectedObras} 
                        onSelect={setSelectedObras}
                        searchPlaceholder="Pesquisar projeto..."
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <span>Cliente</span>
                      <MultiSelectFilter 
                        options={uniqueClientes} 
                        selected={selectedClientes} 
                        onSelect={setSelectedClientes} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <MultiSelectFilter 
                        options={uniqueStatus} 
                        selected={selectedStatus} 
                        onSelect={setSelectedStatus} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vlr Contrato</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Execução Total</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Saldo</TableHead>
                  {columns.map((col) => (
                    <TableHead 
                      key={col.key} 
                      className={`text-center min-w-[110px] ${col.isFuture ? "text-blue-600 font-bold bg-blue-50/50" : ""}`}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30 font-bold border-b-2">
                  <TableCell colSpan={4} className="sticky left-0 bg-muted/30 z-20 text-right">SUBTOTAL</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(stats.totalContrato)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-green-600">{formatCurrency(stats.totalProduzido)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(stats.totalSaldo)}</TableCell>
                  {columns.map((col) => (
                    <TableCell 
                      key={col.key} 
                      className={`text-center whitespace-nowrap ${col.isFuture ? "text-blue-700 bg-blue-100/30" : "text-muted-foreground"}`}
                    >
                      {stats.columnTotals[col.key] > 0 ? formatCurrency(stats.columnTotals[col.key]) : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="sticky left-0 bg-background z-10 border-r">{p.areaObj?.nome || "-"}</TableCell>
                    <TableCell className="font-medium sticky left-[140px] bg-background z-10 border-r">{p.nome}</TableCell>
                    <TableCell className="truncate max-w-[150px]">{p.clienteObj?.razao_social || p.cliente || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${
                        p.status === 'Em Andamento' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(p.valor_total)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-green-600 font-medium">{formatCurrency(p.totalProduzido)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-bold">{formatCurrency(p.saldo)}</TableCell>
                    {columns.map((col) => {
                      const realValue = p.mensal[col.key] || 0;
                      const forecastValue = p.forecast[col.key] || 0;
                      const isEditing = editing?.id === p.id && editing?.month === col.key;

                      return (
                        <TableCell 
                          key={col.key} 
                          className={`text-center group p-1 ${col.isFuture ? "bg-blue-50/20" : ""}`}
                        >
                          {!col.isFuture ? (
                             <span className="text-muted-foreground text-xs">{realValue > 0 ? formatCurrency(realValue) : "-"}</span>
                          ) : isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8 w-24 text-center text-xs"
                                autoFocus
                                onBlur={handleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                              />
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-blue-100/50 rounded p-1 transition-colors min-h-[32px] flex items-center justify-center"
                              onClick={() => handleEdit(p.id, col.key, forecastValue)}
                            >
                              <span className="text-blue-700 font-medium">
                                {forecastValue > 0 ? formatCurrency(forecastValue) : "-"}
                              </span>
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiSelectFilter({ options, selected, onSelect, searchPlaceholder }: { 
  options: string[], 
  selected: string[], 
  onSelect: (val: string[]) => void,
  searchPlaceholder?: string
}) {
  const [search, setSearch] = useState("");
  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Filter className={`h-3 w-3 ${selected.length > 0 ? "text-primary fill-primary/20" : "text-muted-foreground"}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          {searchPlaceholder && (
            <div className="relative mb-2">
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pr-7"
              />
              {search && (
                <button 
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch("")}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between border-b pb-1 mb-1">
            <div className="flex gap-2">
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => onSelect(options)} 
                className="h-auto p-0 text-[10px] text-orange-600"
              >
                Todos
              </Button>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => onSelect([])} 
                className="h-auto p-0 text-[10px] text-orange-600"
              >
                Limpar
              </Button>
            </div>
            <span className="text-[10px] text-muted-foreground">{selected.length} selecionados</span>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 py-1">
            {filteredOptions.length === 0 ? (
              <div className="text-[10px] text-center text-muted-foreground py-2">Nenhum resultado</div>
            ) : (
              filteredOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2 px-1 hover:bg-muted/50 rounded">
                  <Checkbox 
                    id={`filter-${option}`}
                    checked={selected.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) onSelect([...selected, option]);
                      else onSelect(selected.filter(s => s !== option));
                    }}
                    className="h-3.5 w-3.5 border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <label 
                    htmlFor={`filter-${option}`}
                    className="text-xs leading-none cursor-pointer select-none py-1.5 flex-1 truncate"
                  >
                    {option}
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthRangePicker({ startDate, endDate, onSelect }: {
  startDate: Date,
  endDate: Date,
  onSelect: (start: Date, end: Date) => void
}) {
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [viewYearStart, setViewYearStart] = useState(getYear(startDate));
  const [viewYearEnd, setViewYearEnd] = useState(getYear(endDate));

  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 border-orange-200 bg-orange-50/30 text-orange-700 hover:bg-orange-100/50 gap-2">
          <Calendar className="h-4 w-4 text-orange-500" />
          <span className="font-medium">
            {format(startDate, "MMM/yy", { locale: ptBR })} a {format(endDate, "MMM/yy", { locale: ptBR })}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-4" align="start">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="text-center font-semibold text-sm text-muted-foreground">Início</div>
            <div className="flex items-center justify-between px-2">
              <Button variant="ghost" size="sm" onClick={() => setViewYearStart(v => v - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-lg">{viewYearStart}</span>
              <Button variant="ghost" size="sm" onClick={() => setViewYearStart(v => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => {
                const date = setMonth(setYear(startOfMonth(new Date()), viewYearStart), i);
                const isSelected = isEqual(date, tempStart);
                return (
                  <Button
                    key={m}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={`h-9 text-xs ${isSelected ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}`}
                    onClick={() => {
                      setTempStart(date);
                      if (isBefore(tempEnd, date)) {
                        setTempEnd(date);
                        onSelect(date, date);
                      } else {
                        onSelect(date, tempEnd);
                      }
                    }}
                  >
                    {m}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center font-semibold text-sm text-muted-foreground">Fim</div>
            <div className="flex items-center justify-between px-2">
              <Button variant="ghost" size="sm" onClick={() => setViewYearEnd(v => v - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-lg">{viewYearEnd}</span>
              <Button variant="ghost" size="sm" onClick={() => setViewYearEnd(v => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => {
                const date = setMonth(setYear(startOfMonth(new Date()), viewYearEnd), i);
                const isSelected = isEqual(date, tempEnd);
                const isDisabled = isBefore(date, tempStart);
                return (
                  <Button
                    key={m}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    disabled={isDisabled}
                    className={`h-9 text-xs ${isSelected ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}`}
                    onClick={() => {
                      setTempEnd(date);
                      onSelect(tempStart, date);
                    }}
                  >
                    {m}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
