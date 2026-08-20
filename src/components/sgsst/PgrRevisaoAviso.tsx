import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  calcularRevisao,
  textoPrazoRevisao,
  type SituacaoRevisao,
} from "@/utils/sgsstPgrRevisao";

/**
 * Aviso de revisão periódica do PGR — NR-01 1.5.4.4.5.
 *
 * O campo `data_revisao` existia, mas nada avisava quando a revisão vencia. Um
 * PGR vencido é irregular do mesmo jeito que um PGR inexistente, e isso passava
 * em silêncio.
 */

interface PgrRevisaoAvisoProps {
  dataInicio?: string | null;
  dataRevisao?: string | null;
  periodicidadeMeses?: number | null;
  status?: string | null;
  /** `linha` para a tabela de listagem; `bloco` para a tela de detalhe. */
  variante?: "bloco" | "linha";
}

const ESTILO: Record<SituacaoRevisao, { classe: string; icone: typeof AlertTriangle }> = {
  VENCIDO: {
    classe:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    icone: AlertTriangle,
  },
  VENCE_EM_BREVE: {
    classe:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    icone: CalendarClock,
  },
  EM_DIA: {
    classe:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    icone: CheckCircle2,
  },
  NAO_APLICAVEL: { classe: "border-border bg-muted text-muted-foreground", icone: CalendarClock },
};

export function PgrRevisaoAviso({
  dataInicio,
  dataRevisao,
  periodicidadeMeses,
  status,
  variante = "bloco",
}: PgrRevisaoAvisoProps) {
  const calculo = calcularRevisao({
    dataInicio,
    dataRevisao,
    periodicidadeMeses,
    status,
    hoje: new Date(),
  });

  // Em dia e não aplicável não merecem um bloco de aviso ocupando a tela: aviso
  // que aparece sempre deixa de ser aviso.
  if (variante === "bloco" && (calculo.situacao === "EM_DIA" || calculo.situacao === "NAO_APLICAVEL")) {
    return null;
  }

  const { classe, icone: Icone } = ESTILO[calculo.situacao];
  const meses = periodicidadeMeses ?? 24;

  if (variante === "linha") {
    if (calculo.situacao === "NAO_APLICAVEL") {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs whitespace-nowrap ${classe}`}
        title={
          calculo.vencimento
            ? `Vence em ${calculo.vencimento.toLocaleDateString("pt-BR")} · periodicidade de ${meses} meses`
            : undefined
        }
      >
        <Icone className="h-3 w-3" />
        {textoPrazoRevisao(calculo)}
      </span>
    );
  }

  return (
    <div className={`rounded-md border px-3 py-2.5 text-sm ${classe}`}>
      <p className="flex items-start gap-2">
        <Icone className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>
            {calculo.situacao === "VENCIDO"
              ? "Revisão do PGR vencida"
              : "Revisão do PGR a vencer"}
          </strong>{" "}
          — {textoPrazoRevisao(calculo)}
          {calculo.vencimento && (
            <> (vencimento em {calculo.vencimento.toLocaleDateString("pt-BR")})</>
          )}
          .{" "}
          {calculo.primeiraRevisao ? (
            <>
              Nunca houve revisão registrada, então o prazo foi contado a partir do início da
              vigência.
            </>
          ) : null}{" "}
          A NR-01 1.5.4.4.5 exige revisão a cada {meses} meses
          {meses === 24 ? " (a norma admite 36 com sistema de gestão de SST certificado)" : ""}.
        </span>
      </p>
    </div>
  );
}
