import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter } from "lucide-react";

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
}

export function ColumnHeader({ label, sortDir, onSort, searchText, onSearchChange, uniqueValues = [], selectedValues = new Set<string>(), onToggleValue, onSelectAll, onClearAll }: ColumnHeaderProps) {
  const isFiltered = searchText !== "" || selectedValues.size > 0;
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

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
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
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
          <div className="max-h-40 overflow-y-auto space-y-1">
            {uniqueValues
              .filter(v => v.toLowerCase().includes(searchText.toLowerCase()))
              .map(v => (
                <label key={v} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                  <Checkbox
                    checked={selectedValues.has(v)}
                    onCheckedChange={() => onToggleValue(v)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">{v}</span>
                </label>
              ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
