import { useMemo, useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Pie,
  LabelList
} from "recharts";
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

import QuadroGeral from "@/components/relatorios/QuadroGeral";
import { LayoutDashboard, Filter, TrendingUp, BarChart3, PieChart as PieChartIcon, Table as TableIcon } from "lucide-react";
import { MonthRangePicker } from "@/components/analise/MonthRangePicker";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  // Estados para o filtro principal com persistência no localStorage
  const [periodoInicioStr, setPeriodoInicioStr] = usePersistedState<string>(
    "dashboard_periodoInicio",
    startOfYear(new Date()).toISOString()
  );
  const [periodoFimStr, setPeriodoFimStr] = usePersistedState<string>(
    "dashboard_periodoFim",
    endOfYear(new Date()).toISOString()
  );
  
  const periodoInicio = useMemo(() => new Date(periodoInicioStr), [periodoInicioStr]);
  const periodoFim = useMemo(() => new Date(periodoFimStr), [periodoFimStr]);

  const setPeriodoInicio = (d: Date) => setPeriodoInicioStr(d.toISOString());
  const setPeriodoFim = (d: Date) => setPeriodoFimStr(d.toISOString());

  // Estados para o filtro específico do primeiro gráfico com persistência
  const [periodoInicioAnualStr, setPeriodoInicioAnualStr] = usePersistedState<string>(
    "dashboard_periodoInicioAnual",
    startOfYear(new Date()).toISOString()
  );
  const [periodoFimAnualStr, setPeriodoFimAnualStr] = usePersistedState<string>(
    "dashboard_periodoFimAnual",
    endOfYear(new Date()).toISOString()
  );

  const periodoInicioAnual = useMemo(() => new Date(periodoInicioAnualStr), [periodoInicioAnualStr]);
  const periodoFimAnual = useMemo(() => new Date(periodoFimAnualStr), [periodoFimAnualStr]);

  const setPeriodoInicioAnual = (d: Date) => setPeriodoInicioAnualStr(d.toISOString());
  const setPeriodoFimAnual = (d: Date) => setPeriodoFimAnualStr(d.toISOString());

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

  // Filtrar dados por período e desconsiderar centros de custo específicos
  const filteredData = useMemo(() => {
    return biAnalise.filter((p: any) => {
      // Desconsiderar centros de custo "Comercial" e "Administrativo"
      const projetoNome = p.Projeto || "";
      if (
        projetoNome.toLowerCase().trim() === "administrativo" || 
        projetoNome.toLowerCase().trim() === "comercial" ||
        projetoNome.startsWith("Comercial -") ||
        projetoNome.startsWith("Administrativo -")
      ) return false;

      if (!p.Ano || !p["Mês Num"]) return false;
      const dataProducao = new Date(p.Ano, p["Mês Num"] - 1, 1);
      return isWithinInterval(dataProducao, { 
        start: startOfMonth(periodoInicio), 
        end: endOfMonth(periodoFim) 
      });
    });
  }, [biAnalise, periodoInicio, periodoFim]);

  // 1. Gráfico de Produção Total Anual vs MB Real Atingido
  const annualData = useMemo(() => {
    const yearsMap = new Map<number, { year: number, total: number, mb: number }>();
    
    // Filtro específico para o gráfico anual, também desconsiderando Comercial e Administrativo
    const filteredForAnnual = biAnalise.filter((p: any) => {
      const projetoNome = p.Projeto || "";
      if (
        projetoNome.toLowerCase().trim() === "administrativo" || 
        projetoNome.toLowerCase().trim() === "comercial" ||
        projetoNome.startsWith("Comercial -") ||
        projetoNome.startsWith("Administrativo -")
      ) return false;

      if (!p.Ano || !p["Mês Num"]) return false;
      const dataProducao = new Date(p.Ano, p["Mês Num"] - 1, 1);
      return isWithinInterval(dataProducao, { 
        start: startOfMonth(periodoInicioAnual), 
        end: endOfMonth(periodoFimAnual) 
      });
    });

    filteredForAnnual.forEach((p: any) => {
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
  }, [biAnalise, periodoInicioAnual, periodoFimAnual]);

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
    
    // Garantir que todos os meses no intervalo selecionado apareçam
    const months = eachMonthOfInterval({
      start: startOfMonth(periodoInicio),
      end: endOfMonth(periodoFim)
    });

    months.forEach(m => {
      monthsMap.set(format(m, "yyyy-MM"), 0);
    });

    filteredData.forEach((p: any) => {
      const year = p.Ano;
      const month = p["Mês Num"];
      if (!year || !month) return;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      if (monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + Number(p["Produção (POC)"] || 0));
      }
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        const name = format(date, "MMM/yy", { locale: ptBR });
        return {
          name,
          "Produção": value
        };
      });
  }, [filteredData, periodoInicio, periodoFim]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const formatCompactNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  };

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
          <CardHeader className="flex flex-col space-y-4 pb-2">
            <div className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Produção Total Anual vs MB Real
                </CardTitle>
                <CardDescription>Produção total e atingimento acumulado por ano</CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border w-fit">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtrar:
              </Label>
              <MonthRangePicker
                startDate={periodoInicioAnual}
                endDate={periodoFimAnual}
                onChangeStart={setPeriodoInicioAnual}
                onChangeEnd={(d) => setPeriodoFimAnual(endOfMonth(d))}
                className="scale-90 origin-left"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '13px', fontWeight: '500' }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `R$ ${formatCompactNumber(value)}`} 
                    style={{ fontSize: '13px' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px', fontWeight: '500' }}/>
                  <Bar dataKey="Produção Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={50}>
                    <LabelList 
                      dataKey="Produção Total" 
                      position="top" 
                      formatter={(value: number) => formatCompactNumber(value)}
                      style={{ fontSize: '14px', fontWeight: '700', fill: 'hsl(var(--foreground))' }}
                    />
                  </Bar>
                  <Bar dataKey="MB Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={50}>
                    <LabelList 
                      dataKey="MB Real" 
                      position="top" 
                      formatter={(value: number) => formatCompactNumber(value)}
                      style={{ fontSize: '14px', fontWeight: '700', fill: '#059669' }}
                    />
                  </Bar>
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
                <LineChart data={monthlyEvolutionData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '13px', fontWeight: '500' }} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `R$ ${formatCompactNumber(value)}`}
                    style={{ fontSize: '13px' }}
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
                  >
                    <LabelList 
                      dataKey="Produção" 
                      position="top" 
                      offset={12}
                      formatter={(value: number) => formatCompactNumber(value)}
                      style={{ fontSize: '14px', fontWeight: '700', fill: 'hsl(var(--primary))' }}
                    />
                  </Line>
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
            <div className="w-full md:w-1/2 flex flex-col gap-6">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      axisLine={false} 
                      tickLine={false}
                      style={{ fontSize: '13px' }}
                    />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                      {areaData.map((entry, index) => (
                        <Cell key={`cell-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList 
                        dataKey="value" 
                        position="right" 
                        formatter={(value: number) => formatCompactNumber(value)}
                        style={{ fontSize: '13px', fontWeight: '700' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {areaData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground font-semibold">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
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
