import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export type StatTone = "neutro" | "positivo" | "atencao" | "critico" | "info";

const TONE_CLASSES: Record<StatTone, { value: string; icon: string; rail: string }> = {
  neutro: {
    value: "text-foreground",
    icon: "text-muted-foreground",
    rail: "bg-border",
  },
  positivo: {
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    rail: "bg-emerald-500",
  },
  atencao: {
    value: "text-amber-600 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    rail: "bg-amber-500",
  },
  critico: {
    value: "text-red-600 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400",
    rail: "bg-red-500",
  },
  info: {
    value: "text-primary",
    icon: "text-primary",
    rail: "bg-primary",
  },
};

export interface SgsstStat {
  label: string;
  value: number | string;
  tone?: StatTone;
  icon?: LucideIcon;
  /** Texto de apoio abaixo do número. Ex.: "vencendo em 30 dias". */
  hint?: string;
  /** Explicação de como o indicador é calculado, exibida em tooltip. */
  ajuda?: string;
}

interface SgsstStatCardsProps {
  stats: SgsstStat[];
  isLoading?: boolean;
}

/**
 * Linha de indicadores das telas SGSST.
 *
 * Os valores devem vir de contagens sobre a base inteira, nunca de
 * `rows.length` — indicadores derivados da página corrente passam a mentir
 * assim que a lista tem mais de uma página.
 */
export function SgsstStatCards({ stats, isLoading }: SgsstStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const tone = TONE_CLASSES[stat.tone ?? "neutro"];
        const Icon = stat.icon;

        return (
          <Card key={stat.label} className="relative overflow-hidden">
            <span
              className={`absolute inset-y-0 left-0 w-0.5 ${tone.rail}`}
              aria-hidden="true"
            />
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  {stat.ajuda && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Como ${stat.label} é calculado`}
                          className="rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <HelpCircle className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {stat.ajuda}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className={`text-2xl font-bold tabular-nums leading-tight ${tone.value}`}>
                    {stat.value}
                  </p>
                )}

                {stat.hint && !isLoading && (
                  <p className="truncate text-xs text-muted-foreground">{stat.hint}</p>
                )}
              </div>

              {Icon && <Icon className={`h-5 w-5 shrink-0 ${tone.icon}`} aria-hidden="true" />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
