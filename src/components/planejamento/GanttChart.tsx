import { useMemo, useState, useCallback, useRef } from "react";
import { AtividadePlanejamento } from "@/hooks/usePlanejamento";
import { format, addDays, differenceInDays, startOfDay, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react";

interface GanttChartProps {
  atividades: AtividadePlanejamento[];
  onSelectAtividade: (a: AtividadePlanejamento) => void;
  onDragUpdate?: (id: string, newStartDate: string) => void;
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

const ROW_H = 36;
const LABEL_W = 450; // Increased width for more columns
const DAY_W = 38; // Wider for numbers

export function GanttChart({ atividades, onSelectAtividade, onDragUpdate }: GanttChartProps) {
  const today = startOfDay(new Date());
  const [collapsedFrentes, setCollapsedFrentes] = useState<Record<string, boolean>>({});
  const chartRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);

  const { chartStart, chartEnd, totalDays, columns, monthColumns } = useMemo(() => {
    if (!atividades.length) {
      const s = today;
      const e = addDays(today, 30);
      const cols = generateColumns(s, e);
      return { 
        chartStart: s, 
        chartEnd: e, 
        totalDays: 30, 
        columns: cols,
        monthColumns: generateMonthColumns(cols)
      };
    }
    let minDate = today;
    let maxDate = addDays(today, 30);
    atividades.forEach((a) => {
      if (a.data_inicio) {
        const d = startOfDay(parseISO(a.data_inicio));
        if (d < minDate) minDate = d;
      }
      if (a.data_inicio && a.duracao_dias) {
        const end = addDays(parseISO(a.data_inicio), a.duracao_dias);
        if (end > maxDate) maxDate = end;
      }
      if (a.data_fim_prevista) {
        const d = startOfDay(new Date(a.data_fim_prevista));
        if (d > maxDate) maxDate = d;
      }
    });
    minDate = addDays(minDate, -3);
    maxDate = addDays(maxDate, 5);
    const total = differenceInDays(maxDate, minDate);
    const cols = generateColumns(minDate, maxDate);
    return {
      chartStart: minDate,
      chartEnd: maxDate,
      totalDays: Math.max(total, 7),
      columns: cols,
      monthColumns: generateMonthColumns(cols)
    };
  }, [atividades, today]);

  // Group atividades by frente
  const frentes = useMemo(() => {
    const groups: Record<string, { id: string; nome: string; atividades: AtividadePlanejamento[] }> = {};
    atividades.forEach((a) => {
      const fId = a.frente_id;
      if (!groups[fId]) {
        groups[fId] = { id: fId, nome: a.frente_nome || `Frente ${fId}`, atividades: [] };
      }
      groups[fId].atividades.push(a);
    });
    return Object.values(groups);
  }, [atividades]);

  if (!atividades.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Nenhuma atividade cadastrada. Crie frentes e atividades para visualizar o Gantt.
      </div>
    );
  }

  const chartW = totalDays * DAY_W;
  const todayOffset = differenceInDays(today, chartStart) * DAY_W;

  const toggleCollapse = (id: string) => {
    setCollapsedFrentes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex gap-4 px-4 py-2 border-b bg-muted/30 text-xs flex-wrap items-center">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-sm", STATUS_COLORS[key])} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4 border-l pl-4">
           <span className="w-2 h-2 rounded-full bg-purple-600"></span>
           <span className="font-semibold text-purple-700">Atividade Principal</span>
        </div>
        <span className="ml-auto text-muted-foreground italic">Arraste para visualizar produção diária</span>
      </div>

      <div className="flex max-h-[calc(100vh-320px)]">
        {/* Left Panel: Fixed Table Grid */}
        <div className="flex-shrink-0 z-30 bg-card border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] overflow-y-auto" style={{ width: LABEL_W }}
          onScroll={(e) => {
            const target = e.currentTarget;
            if (chartRef.current) chartRef.current.scrollTop = target.scrollTop;
          }}
          ref={(el) => { leftPanelRef.current = el; }}
        >
            <div className="h-[60px] border-b bg-muted/90 flex flex-col justify-end px-3 pb-1 text-[11px] font-bold text-muted-foreground sticky top-0 z-40 backdrop-blur-sm">
              <div className="flex w-full">
                <div className="flex-1">ITEM / FRENTE</div>
                <div className="w-10 text-center">UND</div>
                <div className="w-[70px] text-right">QTD PREV</div>
                <div className="w-[70px] text-right">QTD REAL</div>
                <div className="w-[70px] text-right">A EXEC</div>
              </div>
            </div>

            {frentes.map((frente) => {
              const isCollapsed = !!collapsedFrentes[frente.id];
              const totalFrente = frente.atividades.reduce((acc, a) => acc + (a.quantidade_total || 0), 0);
              const totalExecFrente = frente.atividades.reduce((acc, a) => acc + (a.qtd_produzida || 0), 0);
              
              return (
                <div key={frente.id}>
                  <div 
                    className="border-b flex items-center px-2 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                    style={{ height: ROW_H }}
                    onClick={() => toggleCollapse(frente.id)}
                  >
                    <div className="flex items-center flex-1 overflow-hidden">
                       {isCollapsed ? <ChevronRight className="w-4 h-4 mr-1 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 mr-1 text-muted-foreground" />}
                       <span className="font-bold text-xs truncate uppercase tracking-tight">{frente.nome}</span>
                    </div>
                    <div className="w-10 text-center text-[11px] font-semibold text-muted-foreground">-</div>
                    <div className="w-[70px] text-right text-[11px] font-semibold text-muted-foreground">{totalFrente.toLocaleString('pt-BR')}</div>
                    <div className="w-[70px] text-right text-[11px] font-semibold text-muted-foreground">{totalExecFrente.toLocaleString('pt-BR')}</div>
                    <div className="w-[70px] text-right text-[11px] font-bold">
                       {(totalFrente - totalExecFrente).toLocaleString('pt-BR')}
                    </div>
                  </div>

                  {!isCollapsed && frente.atividades.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "border-b flex items-center px-2 cursor-pointer transition-colors group",
                        a.is_principal ? "bg-purple-50/50 hover:bg-purple-50" : "hover:bg-muted/30"
                      )}
                      style={{ height: ROW_H }}
                      onClick={() => onSelectAtividade(a)}
                    >
                      <div className="flex-1 flex items-center gap-1.5 overflow-hidden pl-5">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_COLORS[a.status || "nao_iniciado"])} />
                        <span className="text-xs truncate" title={a.nome}>
                          {a.is_principal ? <span className="font-bold text-purple-700 mr-1">{a.nome}</span> : a.nome}
                        </span>
                      </div>
                      <div className="w-10 text-center text-[11px] text-muted-foreground tracking-tight">
                         {a.unidade}
                      </div>
                      <div className="w-[70px] text-right text-[11px] text-muted-foreground tracking-tight">
                         {a.quantidade_total.toLocaleString('pt-BR')}
                      </div>
                      <div className="w-[70px] text-right text-[11px] font-medium text-emerald-600 tracking-tight">
                         {a.qtd_produzida?.toLocaleString('pt-BR') || "-"}
                      </div>
                      <div className="w-[70px] text-right text-[11px] font-bold">
                         {(a.quantidade_total - (a.qtd_produzida || 0)).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
        </div>

        {/* Right Panel: Scrollable Calendar Matrix */}
        <div className="flex-1 overflow-auto relative bg-white/50"
          ref={chartRef}
          onScroll={(e) => {
            const target = e.currentTarget;
            if (leftPanelRef.current) leftPanelRef.current.scrollTop = target.scrollTop;
          }}
        >
          <div style={{ width: chartW, minWidth: '100%' }}>
            {/* Header Timeline */}
            <div className="sticky top-0 z-20 bg-card">
              <div className="h-6 border-b bg-muted/80 flex">
                {monthColumns.map((m, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 border-r text-[10px] text-center flex items-center justify-center font-bold text-muted-foreground uppercase tracking-widest"
                    style={{ width: m.width }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="h-[34px] border-b bg-muted/40 flex">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-shrink-0 border-r text-[10px] text-center flex flex-col justify-center",
                      col.isWeekend && "bg-muted/60 text-muted-foreground/50",
                      isSameDay(col.date, today) && "bg-red-50 text-red-600 font-bold"
                    )}
                    style={{ width: DAY_W }}
                  >
                    <div className="leading-none">{format(col.date, "dd")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix Cells Timeline */}
            <div className="relative">
              {/* Background Columns */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {columns.map((col, i) => (
                  <div key={i} className={cn("flex-shrink-0 border-r", col.isWeekend && "bg-muted/20")} style={{ width: DAY_W }} />
                ))}
              </div>

              {/* Rows Data */}
              {frentes.map((frente) => {
                const isCollapsed = !!collapsedFrentes[frente.id];
                return (
                  <div key={frente.id}>
                    <div className="border-b bg-muted/5 z-0" style={{ height: ROW_H }} />
                    
                    {!isCollapsed && frente.atividades.map((a) => {
                       const hasStart = !!a.data_inicio;
                       const start = hasStart ? startOfDay(new Date(a.data_inicio!)) : null;
                       const dur = a.duracao_dias || 1;
                       const left = start ? differenceInDays(start, chartStart) * DAY_W : 0;
                       const width = dur * DAY_W;

                       return (
                         <div key={a.id} className={cn("border-b relative z-10 flex items-center", a.is_principal ? "bg-purple-50/20" : "")} style={{ height: ROW_H }}>
                           
                           {hasStart && width > 0 && (
                             <div 
                               className={cn(
                                 "absolute h-full opacity-20 pointer-events-none",
                                 STATUS_COLORS[a.status || "nao_iniciado"]
                               )}
                               style={{ left: Math.max(left, 0), width: Math.max(width, DAY_W) }}
                             />
                           )}
                           
                           {columns.map((col, j) => {
                             const dataStr = format(col.date, "yyyy-MM-dd");
                             const qtyReal = a.matriz_producao?.[dataStr] || 0;
                             
                             const isDentroPlanejamento = hasStart && a.data_fim_prevista && 
                               (col.date >= startOfDay(new Date(a.data_inicio!))) && 
                               (col.date <= startOfDay(new Date(a.data_fim_prevista)));
                             
                             const qtyPrev = isDentroPlanejamento ? (a.producao_diaria_prevista || 0) : 0;
                             
                             if (!qtyPrev && !qtyReal) return null;
                             
                             const atingiuMeta = qtyReal >= qtyPrev;
                             
                             return (
                               <div 
                                 key={j}
                                 className="absolute h-full border-x flex flex-col justify-between overflow-hidden shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] z-10"
                                 style={{ left: j * DAY_W, width: DAY_W }}
                                 title={`Previsto: ${qtyPrev} | Realizado: ${qtyReal} em ${format(col.date, "dd/MM/yyyy")}`}
                               >
                                 <div className={cn(
                                   "h-1/2 flex items-center justify-center text-[9px] font-medium border-b border-black/5",
                                   qtyPrev > 0 ? "bg-muted/80 text-muted-foreground" : "bg-transparent text-transparent"
                                 )}>
                                   {qtyPrev > 0 ? (qtyPrev > 999 ? '999+' : qtyPrev.toFixed(0)) : ''}
                                 </div>
                                 <div className={cn(
                                   "h-1/2 flex items-center justify-center text-[10px] font-bold",
                                   qtyReal > 0 ? (
                                      atingiuMeta ? "bg-emerald-500/20 text-emerald-700" : 
                                      (qtyPrev > 0 ? "bg-amber-500/20 text-amber-700" : "bg-emerald-500/10 text-emerald-600")
                                   ) : "bg-transparent text-transparent"
                                 )}>
                                   {qtyReal > 0 ? (qtyReal > 999 ? '999+' : qtyReal) : ''}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Today line marker */}
            {todayOffset >= 0 && todayOffset <= chartW && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: todayOffset }}
              />
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

function generateMonthColumns(columns: { date: Date }[]) {
  const months: { label: string; width: number }[] = [];
  if (columns.length === 0) return months;

  let currentMonth = format(columns[0].date, "MMM/yy", { locale: ptBR });
  let currentWidth = 0;

  columns.forEach((col) => {
    const monthLabel = format(col.date, "MMM/yy", { locale: ptBR });
    if (monthLabel === currentMonth) {
      currentWidth += DAY_W;
    } else {
      months.push({ label: currentMonth, width: currentWidth });
      currentMonth = monthLabel;
      currentWidth = DAY_W;
    }
  });

  months.push({ label: currentMonth, width: currentWidth });
  return months;
}
