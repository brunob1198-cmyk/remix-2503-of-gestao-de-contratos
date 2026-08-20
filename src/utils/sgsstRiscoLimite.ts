/**
 * Limite de tolerância e técnica de avaliação do catálogo de riscos.
 *
 * O catálogo guardava o agente e a fonte geradora, mas não o número que
 * transforma o risco em decisão técnica. Sem limite não se pode dizer se uma
 * exposição medida está dentro do permitido — e é isso que define se o risco é
 * aceitável ou se exige medida de controle.
 */

export type TecnicaAvaliacao = "QUALITATIVA" | "QUANTITATIVA";

export const TECNICA_LABEL: Record<TecnicaAvaliacao, string> = {
  QUALITATIVA: "Qualitativa",
  QUANTITATIVA: "Quantitativa",
};

export const TECNICA_AJUDA: Record<TecnicaAvaliacao, string> = {
  QUALITATIVA:
    "Avaliada por inspeção e análise da atividade, sem medição instrumental. É o caso de risco de acidente e ergonômico.",
  QUANTITATIVA:
    "Exige medição com instrumento (dosímetro, bomba de amostragem, medidor de estresse térmico) e comparação com o limite de tolerância.",
};

/**
 * Monta o limite legível: o número sozinho não significa nada sem a unidade.
 *
 * Devolve `null` quando não há limite definido, para a tela poder escolher entre
 * mostrar um traço ou um aviso de pendência — são situações diferentes.
 */
export function formatarLimite(
  limite: number | null | undefined,
  unidade: string | null | undefined
): string | null {
  if (limite === null || limite === undefined) return null;

  // Inteiro sai sem decimal ("85 dB(A)"), fracionário preserva o que foi
  // informado ("0,05 mg/m³") — arredondar limite de tolerância seria alterar
  // dado normativo.
  const numero = Number.isInteger(limite)
    ? String(limite)
    : String(limite).replace(".", ",");

  return unidade ? `${numero} ${unidade}` : numero;
}

/**
 * Lê o limite digitado, aceitando vírgula como separador decimal.
 *
 * O campo é texto e não `input[type=number]` de propósito: o usuário brasileiro
 * digita "0,05" e o input numérico do navegador simplesmente rejeita a vírgula,
 * fazendo o valor sumir sem explicação.
 *
 * Devolve `undefined` quando o texto não é um número válido, para o formulário
 * poder avisar em vez de gravar zero silenciosamente.
 */
export function parseLimite(texto: string): number | null | undefined {
  const limpo = texto.trim();
  if (!limpo) return null;

  const numero = Number(limpo.replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return undefined;

  return numero;
}

/**
 * Risco que exige medição instrumental mas está sem limite cadastrado.
 *
 * É a pendência acionável do catálogo: um risco quantitativo sem limite não
 * permite concluir nada sobre a medição que vier a ser feita.
 */
export function limitePendente(risco: {
  tecnica_avaliacao?: TecnicaAvaliacao | null;
  limite_tolerancia?: number | null;
}): boolean {
  return (
    risco.tecnica_avaliacao === "QUANTITATIVA" &&
    (risco.limite_tolerancia === null || risco.limite_tolerancia === undefined)
  );
}

/**
 * NOTA sobre comparar medição com limite:
 *
 * Não há função de comparação aqui de propósito. Para a maioria dos agentes o
 * risco está em ficar ACIMA do limite, mas para oxigênio em espaço confinado
 * (QUI-05) o perigo é o contrário — a NR-33 33.5.15.2 admite entrada com O₂
 * entre 19,5% e 23%, então tanto a falta quanto o excesso reprovam. Uma função
 * genérica `medicao > limite` daria "conforme" justamente no caso que mata.
 *
 * A comparação entra na fase 3, junto com os dados de monitoramento do
 * inventário do PGR, onde a direção do limite pode ser declarada por agente.
 */
