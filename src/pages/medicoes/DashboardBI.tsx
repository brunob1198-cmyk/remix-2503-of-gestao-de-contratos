import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDashboardBI } from "@/hooks/useDashboardBI";
import { BarChart3, TrendingUp, FileText, DollarSign, Activity, AlertTriangle, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";

function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange }: {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (d: Date | undefined) => void;
  onDateToChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="icon" onClick={() => { onDateFromChange(undefined); onDateToChange(undefined); }} title="Limpar filtro">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(215, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(45, 90%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(30, 80%, 50%)",
];

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(val);

const formatCurrencyFull = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

function KpiCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string; subtitle?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Financeiro Tab ──
function FinanceiroTab({ data }: { data: any[] }) {
  const [projetoFilter, setProjetoFilter] = useState("all");

  const projetos = useMemo(() => {
    const unique = new Map<string, string>();
    data.forEach(d => {
      if (d.projeto_id && d.projeto_codigo) unique.set(d.projeto_id, `${d.projeto_codigo} - ${d.projeto_nome}`);
    });
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    if (projetoFilter === "all") return data;
    return data.filter(d => d.projeto_id === projetoFilter);
  }, [data, projetoFilter]);

  const totalCusto = filtered.reduce((acc, d) => acc + Number(d.valor || 0), 0);
  const totalPago = filtered.filter(d => d.status === "pago").reduce((acc, d) => acc + Number(d.valor || 0), 0);
  const totalPendente = totalCusto - totalPago;

  // By category
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(d => {
      const cat = d.categoria || "Outros";
      map.set(cat, (map.get(cat) || 0) + Number(d.valor || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // By month
  const byMonth = useMemo(() => {
    const map = new Map<string, { pago: number; pendente: number }>();
    filtered.forEach(d => {
      if (!d.ano || !d.mes) return;
      const key = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
      const entry = map.get(key) || { pago: 0, pendente: 0 };
      if (d.status === "pago") entry.pago += Number(d.valor || 0);
      else entry.pendente += Number(d.valor || 0);
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return { mes: `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`, ...val, total: val.pago + val.pendente };
      });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={projetoFilter} onValueChange={setProjetoFilter}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projetos.map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Custo Total" value={formatCurrencyFull(totalCusto)} subtitle={`${filtered.length} lançamentos`} icon={DollarSign} color="bg-blue-500" />
        <KpiCard title="Total Pago" value={formatCurrencyFull(totalPago)} icon={TrendingUp} color="bg-emerald-500" />
        <KpiCard title="Pendente" value={formatCurrencyFull(totalPendente)} icon={AlertTriangle} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrencyFull(val)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Mensal - Pago vs Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => formatCurrencyFull(val)} />
                  <Legend />
                  <Bar dataKey="pago" name="Pago" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendente" name="Pendente" fill="hsl(45, 90%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-2 px-3">Categoria</th>
                  <th className="text-right py-2 px-3">Valor Total</th>
                  <th className="text-right py-2 px-3">% do Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byCategory.map((cat, i) => (
                  <tr key={cat.name} className="hover:bg-muted/50">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {cat.name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{formatCurrencyFull(cat.value)}</td>
                    <td className="py-2 px-3 text-right">{totalCusto > 0 ? ((cat.value / totalCusto) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Produção Tab ──
function ProducaoTab({ data }: { data: any[] }) {
  const [projetoFilter, setProjetoFilter] = useState("all");

  const projetos = useMemo(() => {
    const unique = new Map<string, string>();
    data.forEach(d => {
      if (d.projeto_id && d.projeto_codigo) unique.set(d.projeto_id, `${d.projeto_codigo} - ${d.projeto_nome}`);
    });
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    if (projetoFilter === "all") return data;
    return data.filter(d => d.projeto_id === projetoFilter);
  }, [data, projetoFilter]);

  const totalQtd = filtered.reduce((acc, d) => acc + Number(d.quantidade || 0), 0);
  const totalValor = filtered.reduce((acc, d) => acc + Number(d.valor_produzido || 0), 0);

  // By month
  const byMonth = useMemo(() => {
    const map = new Map<string, { quantidade: number; valor: number }>();
    filtered.forEach(d => {
      if (!d.ano || !d.mes) return;
      const key = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
      const entry = map.get(key) || { quantidade: 0, valor: 0 };
      entry.quantidade += Number(d.quantidade || 0);
      entry.valor += Number(d.valor_produzido || 0);
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return { mes: `${MONTH_NAMES[parseInt(m) - 1]}/${y.slice(2)}`, ...val };
      });
  }, [filtered]);

  // By item
  const byItem = useMemo(() => {
    const map = new Map<string, { descricao: string; quantidade: number; valor: number }>();
    filtered.forEach(d => {
      const key = d.item_codigo || d.item_descricao;
      const entry = map.get(key) || { descricao: d.item_descricao, quantidade: 0, valor: 0 };
      entry.quantidade += Number(d.quantidade || 0);
      entry.valor += Number(d.valor_produzido || 0);
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([codigo, val]) => ({ codigo, ...val }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <Select value={projetoFilter} onValueChange={setProjetoFilter}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="Todos os projetos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os projetos</SelectItem>
          {projetos.map(([id, label]) => (
            <SelectItem key={id} value={id}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Produzido (R$)" value={formatCurrencyFull(totalValor)} icon={DollarSign} color="bg-blue-500" />
        <KpiCard title="Quantidade Total" value={totalQtd.toLocaleString("pt-BR")} subtitle={`${filtered.length} lançamentos`} icon={Activity} color="bg-emerald-500" />
        <KpiCard title="Ticket Médio" value={filtered.length > 0 ? formatCurrencyFull(totalValor / filtered.length) : "R$ 0"} icon={TrendingUp} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produção Mensal (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => formatCurrencyFull(val)} />
                  <Area type="monotone" dataKey="valor" name="Valor" fill="hsl(var(--primary))" fillOpacity={0.2} stroke="hsl(var(--primary))" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Itens por Valor</CardTitle>
          </CardHeader>
          <CardContent>
            {byItem.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byItem} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="codigo" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val: number) => formatCurrencyFull(val)} />
                  <Bar dataKey="valor" name="Valor" fill="hsl(215, 70%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Contratos Tab ──
function ContratosTab({ data }: { data: any[] }) {
  const totalValor = data.reduce((acc, d) => acc + Number(d.valor_total || 0), 0);
  const totalProjetos = data.reduce((acc, d) => acc + Number(d.total_projetos || 0), 0);
  const avgPrazo = data.filter(d => d.percentual_prazo != null).reduce((acc, d, _, arr) => acc + Number(d.percentual_prazo) / arr.length, 0);

  // Status distribution
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => {
      const s = d.status || "Sem status";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Valor Total Contratos" value={formatCurrencyFull(totalValor)} subtitle={`${data.length} contratos`} icon={FileText} color="bg-blue-500" />
        <KpiCard title="Projetos Vinculados" value={totalProjetos.toString()} icon={BarChart3} color="bg-emerald-500" />
        <KpiCard title="Execução Média do Prazo" value={`${avgPrazo.toFixed(0)}%`} icon={Activity} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name} (${value})`}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Execução do Prazo por Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {data.filter(d => d.numero_contrato).map(c => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">{c.numero_contrato}</span>
                    <span className="text-muted-foreground">{c.percentual_prazo != null ? `${c.percentual_prazo}%` : "N/A"}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(c.percentual_prazo || 0, 100)}%`,
                        backgroundColor: (c.percentual_prazo || 0) > 90 ? "hsl(0, 70%, 55%)" : (c.percentual_prazo || 0) > 60 ? "hsl(45, 90%, 50%)" : "hsl(150, 60%, 45%)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.prazo_inicio ? new Date(c.prazo_inicio).toLocaleDateString("pt-BR") : "—"}</span>
                    <span>{c.prazo_fim ? new Date(c.prazo_fim).toLocaleDateString("pt-BR") : "—"}</span>
                  </div>
                </div>
              ))}
              {data.filter(d => d.numero_contrato).length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum contrato com número cadastrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo dos Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-2 px-3">Contrato</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-center py-2 px-3">Projetos</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-center py-2 px-3">% Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map(c => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="py-2 px-3 font-medium">{c.numero_contrato || "Sem número"}</td>
                    <td className="py-2 px-3 text-right font-mono">{c.valor_total ? formatCurrencyFull(c.valor_total) : "—"}</td>
                    <td className="py-2 px-3 text-center">{c.total_projetos}</td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant="outline">{c.status || "—"}</Badge>
                    </td>
                    <td className="py-2 px-3 text-center">{c.percentual_prazo != null ? `${c.percentual_prazo}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──
export default function DashboardBIPage() {
  const { financeiro, producao, contratos, isLoading } = useDashboardBI();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">📊 Dashboard BI</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 Dashboard BI</h1>
        <p className="text-muted-foreground text-sm mt-1">Análise avançada de dados financeiros, produção e contratos</p>
      </div>

      <Tabs defaultValue="financeiro" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financeiro" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="producao" className="gap-2">
            <Activity className="h-4 w-4" />
            Produção
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-2">
            <FileText className="h-4 w-4" />
            Contratos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro">
          <FinanceiroTab data={financeiro} />
        </TabsContent>

        <TabsContent value="producao">
          <ProducaoTab data={producao} />
        </TabsContent>

        <TabsContent value="contratos">
          <ContratosTab data={contratos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
