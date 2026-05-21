import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import QuadroGeral from "@/components/relatorios/QuadroGeral";
import { LayoutDashboard, Filter, TrendingUp, BarChart3, PieChart as PieChartIcon, Table as TableIcon, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";


function MultiSelectFilter({ label, options, selected, onToggle, onSelectAll, onClearAll }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const isActive = selected.size > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9 justify-start px-3 min-w-[140px]", isActive && "border-primary text-primary")}>
          <Filter className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
          {isActive && <span className="ml-auto bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{selected.size}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start">
        <Input
          placeholder={`Pesquisar ${label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-2 text-xs">
          <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
          <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filtered.map(v => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
              <Checkbox
                checked={selected.has(v)}
                onCheckedChange={() => onToggle(v)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{v}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const [periodos, setPeriodos] = useState<Set<string>>(new Set(["all"]));
  const [meses, setMeses] = useState<Set<string>>(new Set(["all"]));

  // Reset to "all" if empty
  useEffect(() => {
    if (periodos.size === 0) setPeriodos(new Set(["all"]));
    if (meses.size === 0) setMeses(new Set(["all"]));
  }, [periodos, meses]);


  // Buscar dados consolidados da VIEW de BI Analise (contém MB Real calculado corretamente)
  const { data: biAnalise = [], isLoading: isLoadingBI } = useQuery({
    queryKey: ["bi_analise_dashboard"],
    staleTime: 1000 * 60 * 30, // 30 minutos de cache
    queryFn: async () => {
      console.log("[Dashboard] Fetching BI Analysis data...");
      const { data, error } = await supabase
        .from("view_bi_analise_obras")
        .select("*");
      
      if (error) throw error;
      console.log(`[Dashboard] Fetched ${data?.length || 0} BI analysis records`);
      return data || [];
    }
  });

  // Filtrar dados por período (Ano e Mês)
  const filteredData = useMemo(() => {
    let data = biAnalise;
    
    if (!periodos.has("all")) {
      data = data.filter((p: any) => periodos.has(p.Ano?.toString()));
    }
    
    if (!meses.has("all")) {
      data = data.filter((p: any) => meses.has(p["Mês Num"]?.toString()));
    }
    
    return data;
  }, [biAnalise, periodos, meses]);



  // 1. Gráfico de Produção Total Anual vs MB Real Atingido
  const annualData = useMemo(() => {
    const yearsMap = new Map<number, { year: number, total: number, mb: number }>();
    biAnalise.forEach((p: any) => {
      const year = p.Ano;
      if (!year) return;
      const current = yearsMap.get(year) || { year, total: 0, mb: 0 };
      current.total += Number(p["Produção (POC)"] || 0);
      current.mb += Number(p["MB Real (R$)"] || 0);
      yearsMap.set(year, current);
    });

    return Array.from(yearsMap.values())
      .sort((a, b) => a.year - b.year)
      .map(d => ({
        name: d.year.toString(),
        "Produção Total": d.total,
        "MB Real": d.mb
      }));
  }, [biAnalise]);

  // 2. Gráfico de Produção por Área
  const areaData = useMemo(() => {
    const areaMap = new Map<string, number>();
    
    filteredData.forEach((p: any) => {
      const areaName = p["Área"] || "Outros";
      areaMap.set(areaName, (areaMap.get(areaName) || 0) + Number(p["Produção (POC)"] || 0));
    });

    return Array.from(areaMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // 3. Gráfico Evolutivo de Produção por Mês
  const monthlyEvolutionData = useMemo(() => {
    const monthsMap = new Map<string, number>();
    
    // Se anos específicos estiverem selecionados, garantir que os meses apareçam para esses anos
    if (!periodos.has("all")) {
      const selectedYears = Array.from(periodos).map(y => parseInt(y));
      selectedYears.forEach(year => {
        for (let i = 1; i <= 12; i++) {
          const monthKey = `${year}-${i.toString().padStart(2, '0')}`;
          monthsMap.set(monthKey, 0);
        }
      });
    }


    filteredData.forEach((p: any) => {
      const year = p.Ano;
      const month = p["Mês Num"];
      if (!year || !month) return;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + Number(p["Produção (POC)"] || 0));
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        const name = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date);
        return {
          name,
          "Produção": value
        };
      });
  }, [filteredData, periodos]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Dashboard (Produção: {formatCurrency(filteredData.reduce((acc, p: any) => acc + Number(p["Produção (POC)"] || 0), 0))})
          </h1>
          <p className="text-muted-foreground">Indicadores de performance e visão geral da produção</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-lg border shadow-sm">
          <Label className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <Filter className="h-4 w-4" /> Período:
          </Label>
          <MonthRangePicker
            startDate={periodoInicio}
            endDate={periodoFim}
            onChangeStart={setPeriodoInicio}
            onChangeEnd={(d) => setPeriodoFim(endOfMonth(d))}
          />
        </div>



      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Produção Anual vs MB Real */}
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Produção Total Anual vs MB Real
              </CardTitle>
              <CardDescription>Produção total e atingimento acumulado por ano</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `R$ ${value >= 1000000 ? (value/1000000).toFixed(1) + 'M' : (value/1000).toFixed(0) + 'k'}`} 
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Bar dataKey="Produção Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="MB Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Evolutivo de Produção Mensal */}
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolutivo de Produção Mensal
              </CardTitle>
              <CardDescription>Produção acumulada mês a mês no período</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyEvolutionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `R$ ${value >= 1000000 ? (value/1000000).toFixed(1) + 'M' : (value/1000).toFixed(0) + 'k'}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Produção" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2, fill: 'white' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 3: Produção por Área */}
        <Card className="shadow-md lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Soma de Produção por Área
              </CardTitle>
              <CardDescription>Distribuição dos valores produzidos por área de atuação</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="h-[300px] w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={areaData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {areaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {areaData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Quadro Geral */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <TableIcon className="h-6 w-6 text-primary" />
              Quadro Geral
            </CardTitle>
            <CardDescription>Visão consolidada por Área / Cliente / Projeto / Site e Gestor</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <QuadroGeral />
        </CardContent>
      </Card>
    </div>
  );
}
