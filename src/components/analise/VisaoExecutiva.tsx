import { useAnaliseObra } from "@/hooks/useAnaliseObra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, TrendingUp, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(2)}`;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function statusColor(pct: number): string {
  if (pct >= 20) return "text-emerald-600";
  if (pct >= 10) return "text-amber-600";
  return "text-red-600";
}

function statusBadge(pct: number) {
  if (pct >= 20) return <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">Saudável</Badge>;
  if (pct >= 10) return <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">Atenção</Badge>;
  return <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">Crítico</Badge>;
}

export function VisaoExecutiva({ projetoId, projetoName, periodoInicio, periodoFim }: { projetoId: string; projetoName: string; periodoInicio?: Date; periodoFim?: Date }) {
  const { data, isLoading } = useAnaliseObra(projetoId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data) return <div className="text-muted-foreground text-center py-12">Sem dados para este projeto</div>;

  const { financeiro, progresso, servicos, alertas, custosCategorias, evolucao } = data;

  return (
    <div className="space-y-6">
      {/* ── BLOCO 1: FINANCEIRO ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Visão Financeira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita (Diário)</p>
              <p className="text-xl font-bold tabular-nums">{fmt(financeiro.receitaTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Custo real</p>
              <p className="text-xl font-bold tabular-nums">{fmt(financeiro.custoReal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Margem</p>
              <p className={`text-xl font-bold tabular-nums ${statusColor(financeiro.margemPercent)}`}>
                {fmt(financeiro.margem)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Margem %</p>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-bold tabular-nums ${statusColor(financeiro.margemPercent)}`}>
                  {fmtPct(financeiro.margemPercent)}
                </p>
                {statusBadge(financeiro.margemPercent)}
              </div>
            </div>
          </div>

          <div className="border-t mt-4 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Custo esperado (BDI)</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(financeiro.custoEsperado)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Desvio custo</p>
              <p className={`text-lg font-semibold tabular-nums flex items-center gap-1 ${
                financeiro.custoReal > financeiro.custoEsperado ? "text-red-600" : "text-emerald-600"
              }`}>
                {financeiro.custoReal > financeiro.custoEsperado ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {fmt(Math.abs(financeiro.custoReal - financeiro.custoEsperado))}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">💸 A faturar</p>
              <p className="text-lg font-semibold tabular-nums">{fmt(financeiro.aFaturar)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Lucro projetado</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">{fmt(financeiro.lucroProjetado)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── BLOCO 2: PROGRESSO ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Visão Física
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Executado (Diário)</span>
                <span className="font-semibold tabular-nums">{fmtPct(progresso.percentExecutado)}</span>
              </div>
              <Progress value={Math.min(progresso.percentExecutado, 100)} className="h-3" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Medido</span>
                <span className="font-semibold tabular-nums">{fmtPct(progresso.percentMedido)}</span>
              </div>
              <Progress value={Math.min(progresso.percentMedido, 100)} className="h-3" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Faturado</span>
                <span className="font-semibold tabular-nums">{fmtPct(progresso.percentFaturado)}</span>
              </div>
              <Progress value={Math.min(progresso.percentFaturado, 100)} className="h-3" />
            </div>
          </div>

          {progresso.percentExecutado > progresso.percentMedido + 5 && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ Executado está {fmtPct(progresso.percentExecutado - progresso.percentMedido)} acima do medido — você está trabalhando e não faturando.
            </p>
          )}

          {evolucao.length > 1 && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-2">Curva de evolução</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="producao" stroke="hsl(var(--primary))" name="Produção" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="custo" stroke="hsl(0 84% 60%)" name="Custo" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="margemAcumulada" stroke="hsl(142 71% 45%)" name="Margem Acum." strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BLOCO 3: ALERTAS ── */}
      {alertas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  a.tipo === "critico" ? "bg-red-50 text-red-800" : a.tipo === "atencao" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"
                }`}>
                  <span>{a.tipo === "critico" ? "🔴" : a.tipo === "atencao" ? "🟡" : "🔵"}</span>
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* ── BLOCO 5: CUSTO ESPERADO VS REAL ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            📉 Custo Esperado vs Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Custo esperado calculado pelo BDI/custo unitário do escopo, proporcional à produção apontada no diário.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Esperado</p>
              <p className="text-lg font-bold tabular-nums">{fmt(financeiro.custoEsperado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Real</p>
              <p className="text-lg font-bold tabular-nums">{fmt(financeiro.custoReal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Desvio</p>
              <p className={`text-lg font-bold tabular-nums flex items-center gap-1 ${
                financeiro.custoReal > financeiro.custoEsperado ? "text-red-600" : "text-emerald-600"
              }`}>
                {financeiro.custoReal > financeiro.custoEsperado ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {fmt(Math.abs(financeiro.custoReal - financeiro.custoEsperado))}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {custosCategorias.map(c => (
              <div key={c.categoria} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <span>{c.categoria}</span>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums text-muted-foreground">Esp: {fmt(c.esperado)}</span>
                  <span className="tabular-nums">Real: {fmt(c.real)}</span>
                  <span className={`tabular-nums font-medium ${
                    c.desvioPercent > 10 ? "text-red-600" : c.desvioPercent > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    {c.desvioPercent > 0 ? "+" : ""}{fmtPct(c.desvioPercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
