/**
 * A CAT foi comunicada dentro do prazo legal?
 *
 * O QUE FALTAVA
 *
 * O documento da CAT imprime a data do acidente e a data de emissão, uma ao lado
 * da outra, e nunca as subtrai. Quem lê tem de fazer a conta — e o prazo da CAT
 * não é um detalhe administrativo: é o artigo 22 da Lei 8.213/91, com multa.
 *
 * O PRAZO
 *
 *   acidente comum .... até o PRIMEIRO DIA ÚTIL seguinte ao da ocorrência
 *   óbito ............. de imediato
 *
 * O QUE ESTE MÓDULO NÃO SABE
 *
 * Feriado. O sistema não tem calendário de feriados, e fingir que tem produziria
 * a pior das saídas: acusar de atraso uma comunicação feita no prazo porque
 * caiu uma segunda-feira de feriado no meio.
 *
 * Então o cálculo conta só sábado e domingo, e a mensagem diz isso. Ela informa
 * a distância e a regra; quem confere decide olhando o calendário daquele ano.
 * Informar sem concluir é pior que concluir certo, e muito melhor que concluir
 * errado sobre uma multa.
 */

export type SituacaoPrazoCat = "SEM_DATA" | "EM_DIA" | "FORA_DO_PRAZO";

/** Só o dia, em ISO. O banco pode devolver data com hora. */
const soODia = (valor?: string | null) => (valor ?? "").trim().slice(0, 10);

/**
 * Data local a partir de "YYYY-MM-DD".
 *
 * O `T00:00` não é enfeite: sem ele o JavaScript lê a string como UTC, e no
 * Brasil a data volta um dia — foi assim que a validade da PT perdeu uma data.
 */
function comoDataLocal(iso: string): Date | null {
  const data = new Date(`${iso}T00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

const comoIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Primeiro dia útil depois da data dada, contando só fim de semana.
 *
 * Sexta -> segunda. Sábado -> segunda. Domingo -> segunda.
 */
export function primeiroDiaUtilSeguinte(iso: string): string | null {
  const data = comoDataLocal(soODia(iso));
  if (!data) return null;

  do {
    data.setDate(data.getDate() + 1);
  } while (data.getDay() === 0 || data.getDay() === 6);

  return comoIso(data);
}

export interface PrazoDaCat {
  situacao: SituacaoPrazoCat;
  /** Dias corridos entre o acidente e a emissão; nulo sem uma das datas. */
  diasCorridos: number | null;
  /** Último dia em que a comunicação estaria no prazo. */
  limite: string | null;
  /** Frase pronta para o documento e para a lista de pendências. */
  texto: string | null;
}

/**
 * Situação do prazo desta CAT.
 *
 * `texto` é null quando está em dia: documento que anuncia o que está certo
 * ensina a ignorar avisos, e aí o que está errado passa junto.
 */
export function prazoDaCat(params: {
  dataAcidente?: string | null;
  dataEmissao?: string | null;
  houveObito?: boolean | null;
}): PrazoDaCat {
  const acidente = soODia(params.dataAcidente);
  const emissao = soODia(params.dataEmissao);

  const vazio: PrazoDaCat = {
    situacao: "SEM_DATA",
    diasCorridos: null,
    limite: null,
    texto: null,
  };

  if (!acidente || !emissao) return vazio;

  const dAcidente = comoDataLocal(acidente);
  const dEmissao = comoDataLocal(emissao);
  if (!dAcidente || !dEmissao) return vazio;

  const diasCorridos = Math.round(
    (dEmissao.getTime() - dAcidente.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Óbito é comunicação imediata (art. 22, §1º): o limite é o próprio dia.
  const limite = params.houveObito ? acidente : primeiroDiaUtilSeguinte(acidente);
  if (!limite) return vazio;

  // Comparação de texto ISO, que ordena igual a calendário em qualquer fuso.
  if (emissao <= limite) {
    return { situacao: "EM_DIA", diasCorridos, limite, texto: null };
  }

  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

  const texto = params.houveObito
    ? `Óbito comunicado ${plural(diasCorridos, "dia")} após a ocorrência. ` +
      "A lei exige comunicação imediata (Lei 8.213/91, art. 22, §1º)."
    : `Comunicada ${plural(diasCorridos, "dia")} após o acidente; o prazo legal ` +
      `era até ${limite} (Lei 8.213/91, art. 22). ` +
      "Feriados não entram nesta conta — confira o calendário do período.";

  return { situacao: "FORA_DO_PRAZO", diasCorridos, limite, texto };
}
