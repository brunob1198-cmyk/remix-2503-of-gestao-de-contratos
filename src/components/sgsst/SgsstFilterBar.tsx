import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal } from "lucide-react";

export interface ActiveFilter {
  /** Rótulo do campo. Ex.: "Status". */
  label: string;
  /** Valor legível já traduzido. Ex.: "Em revisão". */
  value: string;
  /** Volta este filtro ao padrão. */
  onClear: () => void;
}

interface SgsstFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Os <Select>, <DatePicker> etc. da tela. */
  children?: ReactNode;
  /** Filtros ativos, exibidos como chips removíveis. */
  activeFilters?: ActiveFilter[];
  onClearAll?: () => void;
  /** Total de registros que atendem aos filtros. */
  resultCount?: number;
  isLoading?: boolean;
}

/**
 * Barra de filtros padrão das telas SGSST.
 *
 * O ponto central são os chips de filtro ativo: sem eles, um filtro esquecido
 * faz a tela parecer vazia e o usuário conclui que os dados desapareceram.
 * Com os chips, o que está restringindo a lista fica sempre visível e é
 * removível com um clique.
 */
export function SgsstFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
  activeFilters = [],
  onClearAll,
  resultCount,
  isLoading,
}: SgsstFilterBarProps) {
  const hasActive = activeFilters.length > 0 || searchValue.trim().length > 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal
              className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block"
              aria-hidden="true"
            />
            {children}
          </div>
        )}
      </div>

      {(hasActive || typeof resultCount === "number") && (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          {typeof resultCount === "number" && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {isLoading
                ? "Buscando…"
                : `${resultCount} ${resultCount === 1 ? "registro" : "registros"}`}
            </span>
          )}

          {hasActive && <span className="text-xs text-muted-foreground">·</span>}

          {searchValue.trim() && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <span className="text-muted-foreground">Busca:</span>
              <span className="max-w-[16ch] truncate">{searchValue}</span>
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Remover filtro de busca"
                className="ml-0.5 rounded-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {activeFilters.map((f) => (
            <Badge key={f.label} variant="secondary" className="gap-1 font-normal">
              <span className="text-muted-foreground">{f.label}:</span>
              <span>{f.value}</span>
              <button
                type="button"
                onClick={f.onClear}
                aria-label={`Remover filtro ${f.label}`}
                className="ml-0.5 rounded-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {hasActive && onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar tudo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
