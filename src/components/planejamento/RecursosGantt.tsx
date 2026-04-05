import { useMemo } from "react";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Recurso, RecursoAlocacao } from "@/hooks/useRecursos";
import { Badge } from "@/components/ui/badge";
import { User, Truck, Wrench } from "lucide-react";

interface Props {
  recursos: Recurso[];
  alocacoes: RecursoAlocacao[];
  projetoId: string;
  sites: { id: string; codigo?: string; nome: string }[];
}

const ROW_H = 40;
const LABEL_W = 260;
const DAY_W = 28;

const TIPO_ICON: Record<string, React.ReactNode> = {
  pessoa: <User className="h-3.5 w-3.5" />,
  veiculo: <Truck className="h-3.5 w-3.5" />,
  equipamento: <Wrench className="h-3.5 w-3.5" />,
};

const TIPO_COLORS: Record<string, string> = {
  pessoa: "bg-blue-500",
  veiculo: "bg-amber-500",
  equipamento: "bg-violet-500",
};

export function RecursosGantt({ recursos, alocacoes, projetoId, sites }: Props) {
  // Filter alocações for this project
  const projetoAlocacoes = useMemo(
    () => alocacoes.filter((a) => a.projeto_id === projetoId),
    [alocacoes, projetoId]
  );

  // Get unique recurso IDs that have allocations in this project
  const recursoIds = useMemo(
    () => [...new Set(projetoAlocacoes.map((a) => a.recurso_id))],
    [projetoAlocacoes]
  );

  const relevantRecursos = useMemo(
    () => recursos.filter((r) => recursoIds.includes(r.id)),
    [recursos, recursoIds]
  );

  const today = startOfDay(new Date());

  const { chartStart, totalDays, columns } = useMemo(() => {
    if (!projetoAlocacoes.length) {
      const s = addDays(today, -7);
      const e = addDays(today, 30);
      return { chartStart: s, totalDays: 37, columns: generateColumns(s, e) };
    }

    let minDate = today;
    let maxDate = addDays(today, 30);

    projetoAlocacoes.forEach((a) => {
      const start = startOfDay(new Date(a.data_inicio));
      if (start < minDate) minDate = start;
      const end = a.data_fim ? startOfDay(new Date(a.data_fim)) : addDays(today, 7);
      if (end > maxDate) maxDate = end;
    });

    minDate = addDays(minDate, -3);
    maxDate = addDays(maxDate, 5);
    const total = differenceInDays(maxDate, minDate);
    return {
      chartStart: minDate,
      totalDays: Math.max(total, 14),
      columns: generateColumns(minDate, maxDate),
    };
  }, [projetoAlocacoes]);

  const siteMap = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s])),
    [sites]
  );

  if (!relevantRecursos.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Nenhum recurso alocado neste projeto. Vá em Recursos para alocar equipes e equipamentos.
      </div>
    );
  }

  const chartW = totalDays * DAY_W;
  const todayOffset = differenceInDays(today, chartStart) * DAY_W;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-b bg-muted/30 text-xs flex-wrap">
        {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
          <div key={tipo} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", color)} />
            <span className="capitalize">{tipo}</span>
          </div>
        ))}
        <span className="ml-auto text-muted-foreground italic">
          Barras com borda tracejada = sem data fim definida
        </span>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-320px)]" style={{ maxWidth: '100%' }}>
        <div className="flex" style={{ width: LABEL_W + chartW }}>
          {/* Labels */}
          <div className="flex-shrink-0 sticky left-0 z-20 bg-card" style={{ width: LABEL_W }}>
            <div className="h-10 border-b border-r bg-muted/50 flex items-center px-3 text-xs font-semibold text-muted-foreground sticky top-0 z-30">
              Recurso
            </div>
            {relevantRecursos.map((r) => (
              <div
                key={r.id}
                className="border-b border-r flex items-center gap-2 px-3"
                style={{ height: ROW_H }}
              >
                <span className="text-muted-foreground">{TIPO_ICON[r.tipo]}</span>
                <div className="truncate text-xs">
                  <span className="font-medium">{r.nome}</span>
                  {r.cargo && (
                    <span className="text-muted-foreground ml-1">({r.cargo})</span>
                  )}
                  {r.placa && (
                    <span className="text-muted-foreground ml-1">[{r.placa}]</span>
                  )}
                </div>
                <Badge
                  variant={r.status === "alocado" ? "default" : r.status === "livre" ? "secondary" : "outline"}
                  className="text-[10px] ml-auto flex-shrink-0"
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="flex-1 relative" style={{ width: chartW }}>
            {/* Date header */}
            <div className="h-10 border-b bg-muted/50 flex sticky top-0 z-10">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 border-r text-[10px] text-center flex flex-col justify-center",
                    col.isWeekend && "bg-muted/40"
                  )}
                  style={{ width: DAY_W }}
                >
                  <div className="text-muted-foreground leading-none">
                    {format(col.date, "dd", { locale: ptBR })}
                  </div>
                  <div className="text-muted-foreground/60 leading-none mt-0.5">
                    {format(col.date, "EEE", { locale: ptBR }).slice(0, 3)}
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {relevantRecursos.map((r) => {
              const rAlocs = projetoAlocacoes.filter((a) => a.recurso_id === r.id);

              return (
                <div key={r.id} className="border-b relative" style={{ height: ROW_H }}>
                  {/* Grid bg */}
                  <div className="absolute inset-0 flex">
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className={cn("flex-shrink-0 border-r", col.isWeekend && "bg-muted/20")}
                        style={{ width: DAY_W }}
                      />
                    ))}
                  </div>

                  {/* Allocation bars */}
                  {rAlocs.map((aloc) => {
                    const start = startOfDay(new Date(aloc.data_inicio));
                    const end = aloc.data_fim
                      ? startOfDay(new Date(aloc.data_fim))
                      : addDays(today, 7);
                    const left = differenceInDays(start, chartStart) * DAY_W;
                    const width = Math.max(differenceInDays(end, start), 1) * DAY_W;
                    const site = siteMap[aloc.site_id];
                    const isOpen = !aloc.data_fim;

                    return (
                      <Tooltip key={aloc.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-1.5 rounded-md z-10 flex items-center justify-center text-[10px] text-white font-medium drop-shadow select-none",
                              TIPO_COLORS[r.tipo],
                              isOpen && "border-2 border-dashed border-white/50"
                            )}
                            style={{
                              left: Math.max(left, 0),
                              width: Math.max(width, DAY_W),
                              height: ROW_H - 12,
                            }}
                          >
                            <span className="truncate px-1">
                              {site ? `${site.codigo || ""} ${site.nome}`.trim() : "Site"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          <p className="font-semibold">{r.nome}</p>
                          <p>Site: {site?.nome || "—"}</p>
                          <p>Início: {format(start, "dd/MM/yyyy")}</p>
                          <p>Fim: {aloc.data_fim ? format(end, "dd/MM/yyyy") : "Em aberto"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}

            {/* Today line */}
            {todayOffset >= 0 && todayOffset <= chartW && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded-b">
                  Hoje
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateColumns(start: Date, end: Date) {
  const cols: { date: Date; isWeekend: boolean }[] = [];
  const days = differenceInDays(end, start);
  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i);
    cols.push({ date: d, isWeekend: d.getDay() === 0 || d.getDay() === 6 });
  }
  return cols;
}
