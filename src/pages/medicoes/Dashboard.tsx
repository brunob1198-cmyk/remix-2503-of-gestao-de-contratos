import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabasePagination";
import { useProjetos } from "@/hooks/useProjetos";
import { useSites } from "@/hooks/useSites";
import { useAreas } from "@/hooks/useAreas";
import { useLancamentosProducao } from "@/hooks/useLancamentos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import QuadroGeral from "@/components/relatorios/QuadroGeral";
import { LayoutDashboard, Filter, TrendingUp, BarChart3, PieChart as PieChartIcon, Table as TableIcon } from "lucide-react";

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<string>("2026");
  
  // Set default year to current year on mount
  useEffect(() => {
    const currentYear = new Date().getFullYear().toString();
    setPeriodo(currentYear);
  }, []);
  const { projetos } = useProjetos();
  const { sites } = useSites();
  const { areas } = useAreas();
  const { lancamentos: producao } = useLancamentosProducao();

  // Buscar produções do Diário de Obra (RDO)
  const { data: diarioProducoes = [] } = useQuery({
    queryKey: ["diario_producao_dashboard"],
    queryFn: async () => {
      const query = supabase
        .from("diario_producao")
        .select(`
          quantidade, 
          valor_total, 
          item_lpu:itens_lpu(preco_unitario), 
          diario:diarios_obra!inner(
            data, 
            site_id, 
            site:sites(
              area_id, 
              gestor:usuarios(nome)
            )
          )
        `);
      
      const data = await fetchAllPages<any>(query);
      return data.map(p => ({
        quantidade: Number(p.quantidade),
        valor_total: Number(p.valor_total || (Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0))),
        data: p.diario.data,
        area_id: p.diario.site?.area_id,
        gestor_nome: p.diario.site?.gestor?.nome || "Sem gestor"
      }));
    }
  });

  // Unificar dados de produção
  const allProducao = useMemo(() => {
    const manualProd = producao.map(p => ({
      quantidade: Number(p.quantidade),
      valor_total: Number(p.quantidade) * Number(p.item_lpu?.preco_unitario || 0),
      data: p.data_producao,
      area_id: (p.site as any)?.area_id
    }));

    return [...manualProd, ...diarioProducoes];
  }, [producao, diarioProducoes]);

  // Filtrar dados por período
  const filteredProducao = useMemo(() => {
    if (periodo === "all") return allProducao;
    const year = parseInt(periodo);
    return allProducao.filter(p => p.data && new Date(p.data).getFullYear() === year);
  }, [allProducao, periodo]);

  // 1. Gráfico de Produção Total Anual vs MB Real Atingido
  const annualData = useMemo(() => {
    const yearsMap = new Map<number, { year: number, total: number }>();
    allProducao.forEach(p => {
      if (!p.data) return;
      const year = new Date(p.data).getFullYear();
      const current = yearsMap.get(year) || { year, total: 0 };
      current.total += p.valor_total;
      yearsMap.set(year, current);
    });

    return Array.from(yearsMap.values())
      .sort((a, b) => a.year - b.year)
      .map(d => ({
        name: d.year.toString(),
        "Produção Total": d.total,
        "MB Real": d.total * 0.95 // Exemplo de cálculo acumulado simulando o MB real atingido
      }));
  }, [allProducao]);

  // 2. Gráfico de Produção por Área
  const areaData = useMemo(() => {
    const areaMap = new Map<string, number>();
    const areaNames = new Map(areas.map(a => [a.id, a.nome]));

    filteredProducao.forEach(p => {
      const areaName = areaNames.get(p.area_id) || "Outros";
      areaMap.set(areaName, (areaMap.get(areaName) || 0) + p.valor_total);
    });

    return Array.from(areaMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredProducao, areas]);

  // 3. Gráfico Evolutivo de Produção por Mês
  const monthlyEvolutionData = useMemo(() => {
    const monthsMap = new Map<string, number>();
    
    // Se um ano estiver selecionado, garantir que todos os meses apareçam
    if (periodo !== "all") {
      const year = parseInt(periodo);
      const months = eachMonthOfInterval({
        start: startOfYear(new Date(year, 0, 1)),
        end: endOfYear(new Date(year, 0, 1))
      });
      months.forEach(m => {
        monthsMap.set(format(m, "yyyy-MM"), 0);
      });
    }

    filteredProducao.forEach(p => {
      if (!p.data) return;
      const monthKey = format(parseISO(p.data), "yyyy-MM");
      monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + p.valor_total);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        name: format(parseISO(key + "-01"), "MMM/yy", { locale: ptBR }),
        "Produção": value
      }));
  }, [filteredProducao, periodo]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Dashboard
          </h1>
          <p className="text-muted-foreground">Indicadores de performance e visão geral da produção</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border shadow-sm">
          <Label htmlFor="period-filter" className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" /> Filtro:
          </Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger id="period-filter" className="w-[180px] h-9">
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
