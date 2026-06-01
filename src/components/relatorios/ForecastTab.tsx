import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForecast } from "@/hooks/useForecast";
import { format, addMonths, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, TrendingUp, Calculator, Calendar, Filter, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const monthsToShow = 12;

export default function ForecastTab() {
  const { data, isLoading, updateForecast } = useForecast();
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ id: string; month: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Filters
  const [filterObra, setFilterObra] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);

  const today = startOfMonth(new Date());
  
  const columns = useMemo(() => {
    const cols = [];
    for (let i = -3; i < monthsToShow - 3; i++) {
      const date = addMonths(today, i);
      cols.push({
        key: format(date, "yyyy-MM"),
        label: format(date, "MMM/yy", { locale: ptBR }),
        isFuture: isAfter(date, today) || format(date, "yyyy-MM") === format(today, "yyyy-MM"),
        date
      });
    }
    return cols;
  }, [today]);

  const filteredData = useMemo(() => {
    return data.filter(p => {
      const matchObra = p.nome.toLowerCase().includes(filterObra.toLowerCase());
      const matchArea = selectedAreas.length === 0 || (p.areaObj?.nome && selectedAreas.includes(p.areaObj.nome));
      const matchCliente = selectedClientes.length === 0 || 
        selectedClientes.includes(p.clienteObj?.razao_social || p.cliente || "Sem Cliente");
      const matchStatus = selectedStatus.length === 0 || selectedStatus.includes(p.status);
      
      return matchObra && matchArea && matchCliente && matchStatus;
    });
  }, [data, filterObra, selectedAreas, selectedClientes, selectedStatus]);

  const uniqueAreas = useMemo(() => Array.from(new Set(data.map(p => p.areaObj?.nome).filter(Boolean))) as string[], [data]);
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Acompanhamento e Forecast</CardTitle>
            <p className="text-sm text-muted-foreground">Meses em <span className="text-blue-600 font-semibold">azul</span> são projeções futuras.</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Forecast
          </Button>
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
                    <div className="flex flex-col gap-1 py-1">
                      <span>Obra</span>
                      <div className="relative">
                        <Input
                          placeholder="Filtrar..."
                          value={filterObra}
                          onChange={(e) => setFilterObra(e.target.value)}
                          className="h-7 text-[10px] pr-6"
                        />
                        {filterObra && (
                          <button 
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={() => setFilterObra("")}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
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
              <tfoot className="bg-muted/30 font-bold border-t-2">
                <TableRow>
                  <TableCell colSpan={4} className="sticky left-0 bg-muted/30 z-20 text-right">TOTAL</TableCell>
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
              </tfoot>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MultiSelectFilter({ options, selected, onSelect }: { 
  options: string[], 
  selected: string[], 
  onSelect: (val: string[]) => void 
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Filter className={`h-3 w-3 ${selected.length > 0 ? "text-primary fill-primary/20" : "text-muted-foreground"}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Filtros</span>
            {selected.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onSelect([])} 
                className="h-6 text-[10px]"
              >
                Limpar
              </Button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox 
                  id={`filter-${option}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) onSelect([...selected, option]);
                    else onSelect(selected.filter(s => s !== option));
                  }}
                />
                <label 
                  htmlFor={`filter-${option}`}
                  className="text-xs cursor-pointer select-none flex-1 py-1"
                >
                  {option}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
