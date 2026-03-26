import { useMemo, useState } from "react";
import { AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GanttChartProps {
  atividades: AtividadePlanejamento[];
  onSelectAtividade: (a: AtividadePlanejamento) => void;
}

const STATUS_COLORS: Record<string, string> = {
  adiantado: "bg-emerald-500",
  no_prazo: "bg-blue-500",
  atrasado: "bg-red-500",
  nao_iniciado: "bg-muted-foreground/30",
  concluido: "bg-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  adiantado: "Adiantado",
  no_prazo: "No Prazo",
  atrasado: "Atrasado",
  nao_iniciado: "Não Iniciado",
  concluido: "Concluído",
};

export function GanttChart({ atividades, onSelectAtividade }: GanttChartProps) {
  const today = startOfDay(new Date());

  const { chartStart, chartEnd, totalDays, columns } = useMemo(() => {
    if (!atividades.length) {
      const s = today;
      const e = addDays(today, 30);
      return { chartStart: s, chartEnd: e, totalDays: 30, columns: generateColumns(s, e) };
    }

    let minDate = today;
    let maxDate = addDays(today, 30);

    atividades.forEach((a) => {
      if (a.data_inicio) {
        const d = startOfDay(new Date(a.data_inicio));
        if (d < minDate) minDate = d;
      }
      if (a.data_inicio && a.duracao_dias) {
        const end = addDays(new Date(a.data_inicio), a.duracao_dias);
        if (end > maxDate) maxDate = end;
      }
      if (a.data_fim_prevista) {
        const d = startOfDay(new Date(a.data_fim_prevista));
        if (d > maxDate) maxDate = d;
      }
    });

    // Add padding
    minDate = addDays(minDate, -3);
    maxDate = addDays(maxDate, 5);
    const total = differenceInDays(maxDate, minDate);

    return {
      chartStart: minDate,
      chartEnd: maxDate,
      totalDays: Math.max(total, 7),
      columns: generateColumns(minDate, maxDate),
    };
  }, [atividades]);

  if (!atividades.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Nenhuma atividade cadastrada. Crie frentes e atividades para visualizar o Gantt.
      </div>
    );
  }

  const ROW_H = 36;
  const LABEL_W = 280;
  const DAY_W = 32;
  const chartW = totalDays * DAY_W;

  const todayOffset = differenceInDays(today, chartStart) * DAY_W;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Legend */}
      <div className="flex gap-4 px-4 py-2 border-b bg-muted/30 text-xs flex-wrap">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", STATUS_COLORS[key])} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <div className="flex" style={{ minWidth: LABEL_W + chartW }}>
          {/* Left labels */}
          <div className="flex-shrink-0" style={{ width: LABEL_W }}>
            {/* Header */}
            <div className="h-10 border-b border-r bg-muted/50 flex items-center px-3 text-xs font-semibold text-muted-foreground sticky top-0 z-10">
              Atividade
            </div>
            {atividades.map((a) => (
              <div
                key={a.id}
                className="border-b border-r flex items-center px-3 cursor-pointer hover:bg-muted/30 transition-colors"
                style={{ height: ROW_H }}
                onClick={() => onSelectAtividade(a)}
              >
                <div className="truncate text-xs">
                  <span className="text-muted-foreground mr-1.5">{a.frente_nome}:</span>
                  <span className="font-medium">{a.nome}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right chart area */}
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
            {atividades.map((a) => {
              const hasStart = !!a.data_inicio;
              const start = hasStart ? startOfDay(new Date(a.data_inicio!)) : null;
              const dur = a.duracao_dias || 1;
              const left = start ? differenceInDays(start, chartStart) * DAY_W : 0;
              const width = dur * DAY_W;

              return (
                <div
                  key={a.id}
                  className="border-b relative"
                  style={{ height: ROW_H }}
                >
                  {/* Grid bg */}
                  <div className="absolute inset-0 flex">
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-shrink-0 border-r",
                          col.isWeekend && "bg-muted/20"
                        )}
                        style={{ width: DAY_W }}
                      />
                    ))}
                  </div>

                  {/* Bar */}
                  {hasStart && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute top-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-80",
                            STATUS_COLORS[a.status || "nao_iniciado"]
                          )}
                          style={{
                            left: Math.max(left, 0),
                            width: Math.max(width, DAY_W),
                            height: ROW_H - 12,
                          }}
                          onClick={() => onSelectAtividade(a)}
                        >
                          {/* Progress fill */}
                          <div
                            className="absolute inset-0 rounded-md bg-white/20"
                            style={{ width: `${100 - (a.percentual_executado || 0)}%`, right: 0, left: "auto" }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow">
                            {a.percentual_executado?.toFixed(0)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-xs">
                        <p className="font-semibold">{a.nome}</p>
                        <p>Duração: {dur} dias</p>
                        <p>Produzido: {a.qtd_produzida}/{a.quantidade_total}</p>
                        <p>Status: {STATUS_LABELS[a.status || "nao_iniciado"]}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
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
