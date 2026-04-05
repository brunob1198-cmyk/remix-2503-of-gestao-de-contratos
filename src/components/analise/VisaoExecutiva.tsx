import { useAnaliseObra } from "@/hooks/useAnaliseObra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign } from "lucide-react";

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

  const { financeiro, alertas } = data;

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


    </div>
  );
}
