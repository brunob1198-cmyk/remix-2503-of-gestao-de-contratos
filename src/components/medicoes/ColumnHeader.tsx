import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc" | null;

export interface ColumnHeaderProps {
  label: string;
  sortDir: SortDir;
  onSort: () => void;
  searchText: string;
  onSearchChange: (v: string) => void;
  uniqueValues: string[];
  selectedValues: Set<string>;
  onToggleValue: (v: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  /** When true, treats values as ISO dates (YYYY-MM-DD) and groups them by month. */
  isDate?: boolean;
}

export function ColumnHeader({
  label,
  sortDir,
  onSort,
  searchText,
  onSearchChange,
  uniqueValues = [],
  selectedValues = new Set<string>(),
  onToggleValue,
  onSelectAll,
  onClearAll,
  isDate,
}: ColumnHeaderProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const monthlyGroups = useMemo(() => {
    if (!isDate) return null;
    const groups: Record<string, { label: string; values: string[] }> = {};
    for (const v of uniqueValues) {
      if (!v || v === "-" || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue;
      const monthKey = v.slice(0, 7); // YYYY-MM
      if (!groups[monthKey]) {
        const [y, m] = monthKey.split("-");
        const raw = format(new Date(Number(y), Number(m) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
        groups[monthKey] = { label: raw.charAt(0).toUpperCase() + raw.slice(1), values: [] };
      }
      groups[monthKey].values.push(v);
    }
    return Object.entries(groups)
      .map(([k, g]) => [k, { ...g, values: g.values.sort() }] as const)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [uniqueValues, isDate]);

  const toggleMonth = (k: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const dateMatches = (iso: string, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    if (iso.toLowerCase().includes(t)) return true;
    try {
      const br = format(parseISO(iso + (iso.length === 10 ? "T12:00:00" : "")), "dd/MM/yyyy");
      if (br.includes(t)) return true;
      const monthLabel = format(parseISO(iso + (iso.length === 10 ? "T12:00:00" : "")), "MMMM 'de' yyyy", { locale: ptBR }).toLowerCase();
      if (monthLabel.includes(t)) return true;
    } catch { /* noop */ }
    return false;
  };

  const isMonthChecked = (vals: string[]) => vals.length > 0 && vals.every((v) => selectedValues.has(v));
  const isMonthIndeterminate = (vals: string[]) => vals.some((v) => selectedValues.has(v)) && !isMonthChecked(vals);
  const toggleMonthSelection = (vals: string[]) => {
    const allSelected = isMonthChecked(vals);
    vals.forEach((v) => {
      const has = selectedValues.has(v);
      if (allSelected && has) onToggleValue(v);
      else if (!allSelected && !has) onToggleValue(v);
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={onSort} className="flex items-center gap-1 hover:text-foreground transition-colors font-medium">
        {label}
        <SortIcon className="h-3.5 w-3.5" />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`p-0.5 rounded hover:bg-accent transition-colors ${isFiltered ? "text-primary" : "text-muted-foreground"}`}>
            <Filter className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-3" align="start">
          <Input
            placeholder={`Pesquisar ${label.toLowerCase()}...`}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2 text-xs">
            <button onClick={onSelectAll} className="text-primary hover:underline">Todos</button>
            <button onClick={onClearAll} className="text-primary hover:underline">Limpar</button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {isDate && monthlyGroups ? (
              <>
                {monthlyGroups.map(([monthKey, group]) => {
                  const filteredValues = group.values.filter((v) => dateMatches(v, searchText));
                  if (filteredValues.length === 0) return null;
                  const isExpanded = expandedMonths.has(monthKey) || searchText !== "";
                  return (
                    <div key={monthKey} className="space-y-1">
                      <div className="flex items-center gap-1 hover:bg-accent rounded px-1 py-0.5">
                        <button onClick={() => toggleMonth(monthKey)} className="p-0.5 hover:bg-muted rounded">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
                          <Checkbox
                            checked={isMonthChecked(group.values)}
                            onCheckedChange={() => toggleMonthSelection(group.values)}
                            className={cn("h-3.5 w-3.5", isMonthIndeterminate(group.values) && "opacity-60")}
                          />
                          <span className="font-medium">{group.label}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{group.values.length}</span>
                        </label>
                      </div>
                      {isExpanded && (
                        <div className="ml-6 space-y-1">
                          {filteredValues.map((iso) => (
                            <label key={iso} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                              <Checkbox
                                checked={selectedValues.has(iso)}
                                onCheckedChange={() => onToggleValue(iso)}
                                className="h-3.5 w-3.5"
                              />
                              <span>{format(parseISO(iso + "T12:00:00"), "dd/MM/yyyy")}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {uniqueValues.includes("-") && dateMatches("-", searchText) && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedValues.has("-")}
                      onCheckedChange={() => onToggleValue("-")}
                      className="h-3.5 w-3.5"
                    />
                    <span>(vazio)</span>
                  </label>
                )}
              </>
            ) : (
              uniqueValues
                .filter((v) => v.toLowerCase().includes(searchText.toLowerCase()))
                .map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedValues.has(v)}
                      onCheckedChange={() => onToggleValue(v)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
