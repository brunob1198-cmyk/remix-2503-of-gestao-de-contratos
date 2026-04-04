import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, setMonth, setYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChangeStart: (d: Date) => void;
  onChangeEnd: (d: Date) => void;
}

function MonthGrid({ label, year, onYearChange, selectedMonth, selectedYear, onSelect }: {
  label: string;
  year: number;
  onYearChange: (y: number) => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground text-center">{label}</p>
      <div className="flex items-center justify-between px-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onYearChange(year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{year}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onYearChange(year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((m, i) => {
          const isSelected = i === selectedMonth && year === selectedYear;
          return (
            <Button
              key={m}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={cn("h-8 text-xs", isSelected && "bg-primary text-primary-foreground")}
              onClick={() => onSelect(i, year)}
            >
              {m}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthRangePicker({ startDate, endDate, onChangeStart, onChangeEnd }: MonthRangePickerProps) {
  const [startYear, setStartYear] = useState(startDate.getFullYear());
  const [endYear, setEndYear] = useState(endDate.getFullYear());
  const [open, setOpen] = useState(false);

  const handleSelectStart = (month: number, year: number) => {
    const newDate = setMonth(setYear(new Date(2000, 0, 1), year), month);
    onChangeStart(newDate);
    if (newDate > endDate) {
      onChangeEnd(newDate);
      setEndYear(year);
    }
  };

  const handleSelectEnd = (month: number, year: number) => {
    const newDate = setMonth(setYear(new Date(2000, 0, 1), year), month);
    if (newDate < startDate) return;
    onChangeEnd(newDate);
  };

  const labelStart = format(startDate, "MMM/yy", { locale: ptBR });
  const labelEnd = format(endDate, "MMM/yy", { locale: ptBR });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-auto justify-start gap-2 font-normal">
          <CalendarDays className="h-4 w-4" />
          <span className="capitalize">{labelStart}</span>
          <span className="text-muted-foreground">a</span>
          <span className="capitalize">{labelEnd}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
        <div className="flex gap-6">
          <MonthGrid
            label="Início"
            year={startYear}
            onYearChange={setStartYear}
            selectedMonth={startDate.getMonth()}
            selectedYear={startDate.getFullYear()}
            onSelect={handleSelectStart}
          />
          <MonthGrid
            label="Fim"
            year={endYear}
            onYearChange={setEndYear}
            selectedMonth={endDate.getMonth()}
            selectedYear={endDate.getFullYear()}
            onSelect={handleSelectEnd}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
