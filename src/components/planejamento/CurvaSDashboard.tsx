import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AtividadePlanejamento, FrenteObra } from "@/hooks/usePlanejamento";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { differenceInCalendarDays, addDays, format, max, min, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  atividades: AtividadePlanejamento[];
  frentes: FrenteObra[];
}

interface CurvaDataPoint {
  date: string;
  label: string;
  planejado: number;
  realizado: number;
}

export function CurvaSDashboard({ atividades, frentes }: Props) {
  const analysis = useMemo(() => {
    if (!atividades.length) return null;

    const atividadesComInicio = atividades.filter((a) => a.data_inicio);
    if (!atividadesComInicio.length) return null;

    // Find project date range
    const inicios = atividadesComInicio.map((a) => parseISO(a.data_inicio!));
    const projetoInicio = min(inicios);

    const fins = atividadesComInicio.map((a) => {
      if (a.data_fim_prevista) return parseISO(a.data_fim_prevista);
      const dur = a.duracao_dias || Math.ceil((a.quantidade_total || 1) / (a.producao_diaria_prevista || 1));
      return addDays(parseISO(a.data_inicio!), dur - 1);
    });
    const projetoFim = max(fins);

    const today = new Date();
    const chartEnd = max([projetoFim, today]);

    // Generate S-Curve data (weekly sampling for performance)
    const totalDays = differenceInCalendarDays(chartEnd, projetoInicio);
    const step = Math.max(1, Math.floor(totalDays / 60)); // ~60 data points max
    const curvaData: CurvaDataPoint[] = [];

    const qtdTotalProjeto = atividadesComInicio.reduce((s, a) => s + (a.quantidade_total || 0), 0);
    if (qtdTotalProjeto === 0) return null;

    for (let d = 0; d <= totalDays; d += step) {
      const currentDate = addDays(projetoInicio, d);

      // Planned cumulative %
      let planejadoQtd = 0;
      atividadesComInicio.forEach((a) => {
        const aInicio = parseISO(a.data_inicio!);
        const dur = a.duracao_dias || Math.ceil((a.quantidade_total || 1) / (a.producao_diaria_prevista || 1));
        const aFim = addDays(aInicio, dur - 1);
        const diasPassados = differenceInCalendarDays(currentDate, aInicio);

        if (diasPassados <= 0) return;
        if (currentDate >= aFim) {
          planejadoQtd += a.quantidade_total || 0;
        } else {
          const pctDia = diasPassados / dur;
          planejadoQtd += (a.quantidade_total || 0) * Math.min(1, pctDia);
        }
      });

      // Actual cumulative % based on real production timing
      let realizadoQtd = 0;
      if (currentDate <= today) {
        atividadesComInicio.forEach((a) => {
          const aInicio = parseISO(a.data_inicio!);
          const qtdProd = a.qtd_produzida || 0;
          if (qtdProd <= 0) return;
          if (currentDate < aInicio) return;

          // For completed activities, use actual duration (start to end date or last production)
          const isComplete = qtdProd >= (a.quantidade_total || 0);
          const dur = a.duracao_dias || Math.ceil((a.quantidade_total || 1) / (a.producao_diaria_prevista || 1));
          const aFimReal = isComplete 
            ? (a.data_fim_prevista ? parseISO(a.data_fim_prevista) : addDays(aInicio, dur - 1))
            : today;

          if (currentDate >= aFimReal) {
            // Past the end — count full produced quantity
            realizadoQtd += qtdProd;
          } else {
            // In progress — linear interpolation over activity's actual span
            const diasTotal = Math.max(1, differenceInCalendarDays(aFimReal, aInicio));
            const diasPassados = differenceInCalendarDays(currentDate, aInicio);
            const frac = Math.min(1, diasPassados / diasTotal);
            realizadoQtd += qtdProd * frac;
          }
        });
      }

      curvaData.push({
        date: format(currentDate, "yyyy-MM-dd"),
        label: format(currentDate, "dd/MM", { locale: ptBR }),
        planejado: Math.round((planejadoQtd / qtdTotalProjeto) * 1000) / 10,
        realizado: currentDate <= today ? Math.round((realizadoQtd / qtdTotalProjeto) * 1000) / 10 : 0,
      });
    }

    // Summary stats
    const totalAtividades = atividades.length;
    const atrasadas = atividades.filter((a) => a.status === "atrasado");
    const concluidas = atividades.filter((a) => a.status === "concluido");
    const emAndamento = atividades.filter((a) => a.status === "no_prazo" || a.status === "adiantado");

    const avgPct = atividades.reduce((s, a) => s + (a.percentual_executado || 0), 0) / totalAtividades;

    // Planned % for today
    let planejadoHoje = 0;
    atividadesComInicio.forEach((a) => {
      const aInicio = parseISO(a.data_inicio!);
      const dur = a.duracao_dias || 1;
      const diasPassados = differenceInCalendarDays(today, aInicio);
      if (diasPassados <= 0) return;
      const pct = Math.min(100, (diasPassados / dur) * 100);
      planejadoHoje += pct;
    });
    planejadoHoje = planejadoHoje / totalAtividades;
    const desvio = avgPct - planejadoHoje;

    // Deadline forecast
    const diasTotaisProjeto = differenceInCalendarDays(projetoFim, projetoInicio);
    let previsaoFim = projetoFim;
    if (avgPct > 0) {
      const diasPassados = differenceInCalendarDays(today, projetoInicio);
      const velocidadeReal = avgPct / Math.max(1, diasPassados);
      const diasRestantes = Math.ceil((100 - avgPct) / velocidadeReal);
      previsaoFim = addDays(today, diasRestantes);
    }
    const atrasoPrevisao = differenceInCalendarDays(previsaoFim, projetoFim);

    // Per-frente progress
    const frenteStats = frentes.map((f) => {
      const atsFrente = atividades.filter((a) => a.frente_id === f.id);
      const avg = atsFrente.length
        ? atsFrente.reduce((s, a) => s + (a.percentual_executado || 0), 0) / atsFrente.length
        : 0;
      const atrasadasF = atsFrente.filter((a) => a.status === "atrasado").length;
      return {
        nome: f.nome,
        progresso: Math.round(avg * 10) / 10,
        atrasadas: atrasadasF,
        total: atsFrente.length,
      };
    });

    return {
      curvaData,
      totalAtividades,
      atrasadas,
      concluidas,
      emAndamento,
      avgPct: Math.round(avgPct * 10) / 10,
      planejadoHoje: Math.round(planejadoHoje * 10) / 10,
      desvio: Math.round(desvio * 10) / 10,
      projetoInicio,
      projetoFim,
      previsaoFim,
      atrasoPrevisao,
      frenteStats,
    };
  }, [atividades, frentes]);

  if (!analysis) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
          Cadastre atividades com data de início para visualizar a Curva S
        </CardContent>
      </Card>
    );
  }

  const statusColor = (desvio: number) => {
    if (desvio >= 0) return "text-emerald-500";
    if (desvio >= -10) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progresso Real</p>
                <p className="text-2xl font-bold">{analysis.avgPct}%</p>
                <p className="text-xs text-muted-foreground">Planejado: {analysis.planejadoHoje}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${analysis.desvio >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {analysis.desvio >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Desvio</p>
                <p className={`text-2xl font-bold ${statusColor(analysis.desvio)}`}>
                  {analysis.desvio > 0 ? "+" : ""}
                  {analysis.desvio}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysis.desvio >= 0 ? "Adiantado" : "Atrasado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${analysis.atrasoPrevisao <= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previsão Término</p>
                <p className="text-lg font-bold">
                  {format(analysis.previsaoFim, "dd/MM/yy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysis.atrasoPrevisao > 0
                    ? `+${analysis.atrasoPrevisao} dias`
                    : analysis.atrasoPrevisao < 0
                    ? `${analysis.atrasoPrevisao} dias`
                    : "No prazo"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertas de Atraso</p>
                <p className="text-2xl font-bold text-red-500">{analysis.atrasadas.length}</p>
                <p className="text-xs text-muted-foreground">
                  de {analysis.totalAtividades} atividades
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* S-Curve Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Curva S — Planejado vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analysis.curvaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`]}
                  labelFormatter={(l) => `Data: ${l}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="planejado"
                  name="Planejado"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="realizado"
                  name="Realizado"
                  stroke="hsl(142 76% 36%)"
                  fill="hsl(142 76% 36% / 0.1)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Per-frente progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Progresso por Frente</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.frenteStats.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.frenteStats} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Progresso"]} />
                    <Bar dataKey="progresso" radius={[0, 4, 4, 0]}>
                      {analysis.frenteStats.map((f, i) => (
                        <Cell
                          key={i}
                          fill={
                            f.progresso >= 80
                              ? "hsl(142 76% 36%)"
                              : f.progresso >= 40
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted-foreground))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem frentes cadastradas</p>
            )}
          </CardContent>
        </Card>

        {/* Delay alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Atividades Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.atrasadas.length > 0 ? (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {analysis.atrasadas.map((a) => {
                  const gap = (a.percentual_executado || 0) - 100;
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-md border bg-red-500/5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">{a.frente_nome}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <Badge variant="destructive" className="text-xs">
                          {a.percentual_executado}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-emerald-500">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Nenhuma atividade atrasada!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Início: <strong>{format(analysis.projetoInicio, "dd/MM/yyyy", { locale: ptBR })}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Fim Previsto: <strong>{format(analysis.projetoFim, "dd/MM/yyyy", { locale: ptBR })}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Concluídas: <strong>{analysis.concluidas.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Em Andamento: <strong>{analysis.emAndamento.length}</strong>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
