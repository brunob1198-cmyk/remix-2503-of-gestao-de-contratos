import { useState, useMemo, memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Sun, Cloud, CloudRain, CloudSnow,
  CloudLightning, CloudDrizzle, CloudSun, Wind, Droplets,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  subMonths, addWeeks, subWeeks, isSameMonth, isSameDay, parseISO, isWithinInterval,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DiarioCalendarioEntry {
  id: string;
  data: string;
  clima: string | null;
  observacoes: string | null;
  totalProducao: number;
  totalItens: number;
  totalEquipe: number;
}

const CLIMA_OPTIONS = [
  { value: "ensolarado", label: "Ensolarado", icon: Sun, color: "text-amber-500" },
  { value: "parcialmente_nublado", label: "Parcialmente Nublado", icon: CloudSun, color: "text-sky-400" },
  { value: "nublado", label: "Nublado", icon: Cloud, color: "text-slate-400" },
  { value: "chuvoso", label: "Chuvoso", icon: CloudRain, color: "text-blue-500" },
  { value: "garoa", label: "Garoa", icon: CloudDrizzle, color: "text-blue-400" },
  { value: "tempestade", label: "Tempestade", icon: CloudLightning, color: "text-purple-500" },
  { value: "ventoso", label: "Ventoso", icon: Wind, color: "text-teal-500" },
  { value: "neve", label: "Neve", icon: CloudSnow, color: "text-sky-300" },
  { value: "umido", label: "Úmido", icon: Droplets, color: "text-cyan-500" },
];

export { CLIMA_OPTIONS };

const CLIMA_MAP = new Map(CLIMA_OPTIONS.map(o => [o.value, o] as const));

const ClimaIcon = memo(function ClimaIcon({ clima }: { clima: string }) {
  const opt = CLIMA_MAP.get(clima);
  if (!opt) return null;
  const Icon = opt.icon;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className={`h-3.5 w-3.5 ${opt.color}`} />
      <span className="text-[8px] leading-none text-muted-foreground font-medium">{opt.label}</span>
    </div>
  );
});

interface DiarioCalendarioProps {
  entries: DiarioCalendarioEntry[];
  onDayClick?: (date: string) => void;
  periodoInicio: string;
  periodoFim: string;
  onPeriodoChange: (inicio: string, fim: string) => void;
}

type ViewMode = "semanal" | "mensal";

interface DayCellProps {
  dateStr: string;
  dayNum: string;
  dayOfWeek: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPastOrToday: boolean;
  isInPeriod: boolean;
  viewMode: ViewMode;
  /** Props do lançamento normalizadas em primitivos para manter identidade estável. */
  hasEntry: boolean;
  clima: string | null;
  totalItens: number;
  totalEquipe: number;
  totalProducao: number;
  onDayClick?: (date: string) => void;
}

const DayCell = memo(function DayCell({
  dateStr, dayNum, dayOfWeek, isCurrentMonth, isToday, isPastOrToday,
  isInPeriod, viewMode, hasEntry, clima, totalItens, totalEquipe, totalProducao, onDayClick,
}: DayCellProps) {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isWorkday = !isWeekend && isCurrentMonth && isInPeriod;

  let bgClass = "bg-background";
  if (!isCurrentMonth) {
    bgClass = "bg-muted/30";
  } else if (hasEntry) {
    bgClass = "bg-emerald-50 dark:bg-emerald-950/30";
  } else if (isWorkday && isPastOrToday) {
    bgClass = "bg-red-50 dark:bg-red-950/20";
  } else if (isWeekend) {
    bgClass = "bg-muted/20";
  }

  const handleClick = useCallback(() => onDayClick?.(dateStr), [onDayClick, dateStr]);

  return (
    <div
      onClick={handleClick}
      className={`relative border-r last:border-r-0 p-1.5 transition-colors hover:bg-accent/50 cursor-pointer
        ${viewMode === "semanal" ? "min-h-[140px]" : "min-h-[90px]"}
        ${bgClass}
        ${!isCurrentMonth ? "opacity-40" : ""}
      `}
    >
      <div className="flex items-start justify-between">
        <span
          className={`text-sm font-medium tabular-nums leading-none
            ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}
            ${isWeekend && !isToday ? "text-muted-foreground" : ""}
          `}
        >
          {dayNum}
        </span>
        {clima && (
          <span className="shrink-0"><ClimaIcon clima={clima} /></span>
        )}
      </div>

      {hasEntry && (
        <div className="mt-1 space-y-0.5">
          {totalItens > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              {totalItens} {totalItens === 1 ? "item" : "itens"}
            </Badge>
          )}
          {totalEquipe > 0 && viewMode === "semanal" && (
            <div className="text-[10px] text-muted-foreground">
              👷 {totalEquipe}
            </div>
          )}
          {totalProducao > 0 && viewMode === "semanal" && (
            <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
              R$ {totalProducao.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          )}
        </div>
      )}

      {!hasEntry && isWorkday && isPastOrToday && isCurrentMonth && (
        <div className="mt-1">
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-red-300 text-red-500">
            Sem Produção
          </Badge>
        </div>
      )}

      {hasEntry && totalItens === 0 && isCurrentMonth && (
        <div className="mt-1">
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-600">
            Sem Produção
          </Badge>
        </div>
      )}
    </div>
  );
});


const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DiarioCalendario({
  entries,
  onDayClick,
  periodoInicio,
  periodoFim,
  onPeriodoChange,
}: DiarioCalendarioProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("mensal");
  const [currentDate, setCurrentDate] = useState(new Date());

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DiarioCalendarioEntry>();
    entries.forEach(e => map.set(e.data, e));
    return map;
  }, [entries]);

  const calendarDays = useMemo(() => {
    if (viewMode === "mensal") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      const days: Date[] = [];
      let day = calStart;
      while (day <= calEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return days;
    }
  }, [currentDate, viewMode]);

  const navigate = useCallback((direction: number) => {
    setCurrentDate(prev => {
      if (viewMode === "mensal") {
        return direction > 0 ? addMonths(prev, 1) : subMonths(prev, 1);
      }
      return direction > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1);
    });
  }, [viewMode]);

  const title = viewMode === "mensal"
    ? format(currentDate, "MMMM / yyyy", { locale: ptBR }).toUpperCase()
    : `Semana de ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM", { locale: ptBR })} a ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "dd/MM/yyyy", { locale: ptBR })}`;

  const todayTs = useMemo(() => startOfDay(new Date()).getTime(), []);
  const periodoInicioDate = useMemo(() => parseISO(periodoInicio), [periodoInicio]);
  const periodoFimDate = useMemo(() => parseISO(periodoFim), [periodoFim]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Precompute cell props so DayCell can be memoized on primitive props
  const rows = useMemo(() => {
    return weeks.map(week => ({
      // Chave estável por semana (data do primeiro dia) em vez do índice.
      key: format(week[0], "yyyy-MM-dd"),
      cells: week.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const isCurrentMonth = viewMode === "mensal" ? isSameMonth(day, currentDate) : true;
        return {
          dateStr,
          dayNum: format(day, "dd"),
          dayOfWeek: day.getDay(),
          isCurrentMonth,
          isToday: isSameDay(day, new Date(todayTs)),
          isPastOrToday: day.getTime() <= todayTs,
          isInPeriod: isWithinInterval(day, { start: periodoInicioDate, end: periodoFimDate }),
        };
      }),
    }));
  }, [weeks, viewMode, currentDate, todayTs, periodoInicioDate, periodoFimDate]);

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-lg font-bold tracking-tight min-w-[200px]">{title}</h2>

        <div className="flex items-center gap-2 ml-auto">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Período:</span>
          <Input
            type="date"
            value={periodoInicio}
            onChange={e => onPeriodoChange(e.target.value, periodoFim)}
            className="w-[150px] h-8 text-sm"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <Input
            type="date"
            value={periodoFim}
            onChange={e => onPeriodoChange(periodoInicio, e.target.value)}
            className="w-[150px] h-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={goToday}>
          Hoje
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span>Com lançamento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span>Sem lançamento (dia útil)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span>Fim de semana / Fora do período</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {WEEK_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {rows.map(row => (
            <div key={row.key} className="grid grid-cols-7 border-b last:border-b-0">
              {row.cells.map(cell => {
                const entry = entriesByDate.get(cell.dateStr);
                return (
                  <DayCell
                    key={cell.dateStr}
                    dateStr={cell.dateStr}
                    dayNum={cell.dayNum}
                    dayOfWeek={cell.dayOfWeek}
                    isCurrentMonth={cell.isCurrentMonth}
                    isToday={cell.isToday}
                    isPastOrToday={cell.isPastOrToday}
                    isInPeriod={cell.isInPeriod}
                    viewMode={viewMode}
                    hasEntry={!!entry}
                    clima={entry?.clima ?? null}
                    totalItens={entry?.totalItens ?? 0}
                    totalEquipe={entry?.totalEquipe ?? 0}
                    totalProducao={entry?.totalProducao ?? 0}
                    onDayClick={onDayClick}
                  />
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
