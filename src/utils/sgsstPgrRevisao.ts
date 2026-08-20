import { somarMeses } from "@/utils/sgsstConvocacao";

/**
 * Revisão periódica do PGR — NR-01 1.5.4.4.5.
 *
 * O campo `data_revisao` existia, mas nada avisava quando a revisão vencia. Um
 * PGR vencido é irregular do mesmo jeito que um PGR inexistente, e passava
 * silenciosamente.
 *
 * A periodicidade é dado, não constante: a regra geral é 2 anos, mas a norma
 * admite 3 anos quando há sistema de gestão de SST certificado.
 */

export type SituacaoRevisao = "VENCIDO" | "VENCE_EM_BREVE" | "EM_DIA" | "NAO_APLICAVEL";

export const SITUACAO_REVISAO_LABEL: Record<SituacaoRevisao, string> = {
  VENCIDO: "Revisão vencida",
  VENCE_EM_BREVE: "Revisão a vencer",
  EM_DIA: "Revisão em dia",
  NAO_APLICAVEL: "Não se aplica",
};

/** Janela de aviso: tempo hábil para reunir dados e revisar sem estourar. */
export const JANELA_AVISO_REVISAO_DIAS = 90;

export interface CalculoRevisao {
  /** Data em que a revisão vence, ou null quando não se aplica. */
  vencimento: Date | null;
  /** Negativo = atrasado. Null quando não se aplica. */
  diasRestantes: number | null;
  situacao: SituacaoRevisao;
  /** True quando o vencimento foi contado da data de início, sem revisão prévia. */
  primeiraRevisao: boolean;
}

function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function diasEntre(de: Date, para: Date): number {
  const MS_DIA = 24 * 60 * 60 * 1000;
  const inicio = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const fim = new Date(para.getFullYear(), para.getMonth(), para.getDate()).getTime();
  return Math.round((fim - inicio) / MS_DIA);
}

/**
 * Quando a próxima revisão vence.
 *
 * A base é a última revisão realizada; nunca tendo havido revisão, conta da data
 * de início do programa — o prazo corre desde que o PGR passou a valer, não
 * desde uma revisão que não aconteceu.
 *
 * PGR encerrado não gera alerta: cobrar revisão de programa encerrado é ruído.
 */
export function calcularRevisao(params: {
  dataInicio?: string | null;
  dataRevisao?: string | null;
  periodicidadeMeses?: number | null;
  status?: string | null;
  hoje: Date;
}): CalculoRevisao {
  const { dataInicio, dataRevisao, periodicidadeMeses, status, hoje } = params;

  const naoAplicavel: CalculoRevisao = {
    vencimento: null,
    diasRestantes: null,
    situacao: "NAO_APLICAVEL",
    primeiraRevisao: false,
  };

  if (status === "ENCERRADO") return naoAplicavel;

  const meses = periodicidadeMeses ?? 24;
  if (meses <= 0) return naoAplicavel;

  const base = dataRevisao || dataInicio;
  if (!base) return naoAplicavel;

  const vencimento = somarMeses(comoData(base), meses);
  const diasRestantes = diasEntre(hoje, vencimento);

  const situacao: SituacaoRevisao =
    diasRestantes < 0
      ? "VENCIDO"
      : diasRestantes <= JANELA_AVISO_REVISAO_DIAS
        ? "VENCE_EM_BREVE"
        : "EM_DIA";

  return {
    vencimento,
    diasRestantes,
    situacao,
    primeiraRevisao: !dataRevisao,
  };
}

/** Texto do prazo, pronto para a interface. */
export function textoPrazoRevisao(calculo: CalculoRevisao): string {
  if (calculo.diasRestantes === null) return "—";
  if (calculo.diasRestantes < 0) {
    const dias = Math.abs(calculo.diasRestantes);
    return `${dias} dia${dias === 1 ? "" : "s"} em atraso`;
  }
  if (calculo.diasRestantes === 0) return "vence hoje";
  return `em ${calculo.diasRestantes} dia${calculo.diasRestantes === 1 ? "" : "s"}`;
}

/** Urgência primeiro: vencido, a vencer, em dia, não aplicável. */
export const ORDEM_REVISAO: Record<SituacaoRevisao, number> = {
  VENCIDO: 0,
  VENCE_EM_BREVE: 1,
  EM_DIA: 2,
  NAO_APLICAVEL: 3,
};
