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
 * Onde a medição caiu em relação ao limite.
 *
 * Uma versão anterior deste arquivo se recusava a comparar, com o argumento de
 * que para oxigênio em espaço confinado a NR-33 33.5.15.2 admite entrada só
 * entre 19,5% e 23% — então tanto a falta quanto o excesso reprovam, e um
 * `medicao > limite` genérico daria "conforme" justamente no caso que mata.
 *
 * O argumento continua válido, mas ele é sobre CONFORMIDADE, não sobre posição.
 * O campo do inventário do PGR guarda `ABAIXO_LIMITE | ACIMA_LIMITE`, que é
 * posição — e posição é aritmética. Estas funções devolvem só isso, e de
 * propósito não devolvem nada parecido com "conforme": quem lê 91 contra um
 * limite de 84 precisa saber que está acima; se estar acima é bom ou ruim
 * depende do agente, e essa parte segue declarada por quem preenche.
 */
export type PosicaoLimite = "ABAIXO" | "IGUAL" | "ACIMA" | "INDETERMINADA";

export interface ComparacaoComLimite {
  posicao: PosicaoLimite;
  /** Quanto por cento acima ou abaixo. Nulo quando o limite é zero ou falta dado. */
  percentual: number | null;
}

export function compararComLimite(
  medida: number | null | undefined,
  limite: number | null | undefined
): ComparacaoComLimite {
  const semDado =
    medida === null ||
    medida === undefined ||
    limite === null ||
    limite === undefined ||
    !Number.isFinite(medida) ||
    !Number.isFinite(limite);
  if (semDado) return { posicao: "INDETERMINADA", percentual: null };

  // Igual ao limite não é acima: a NR-15 trata o limite de tolerância como o
  // máximo admissível, então o valor exato ainda está dentro dele.
  const posicao: PosicaoLimite = medida > limite ? "ACIMA" : medida < limite ? "ABAIXO" : "IGUAL";

  // Limite zero não admite percentual — seria divisão por zero.
  const percentual = limite === 0 ? null : ((medida - limite) / limite) * 100;

  return { posicao, percentual };
}

/** Frase curta para a tela. Sempre factual, nunca um veredito. */
export function textoDaComparacao(c: ComparacaoComLimite): string | null {
  if (c.posicao === "INDETERMINADA") return null;
  if (c.posicao === "IGUAL") return "exatamente no limite de tolerância";

  const lado = c.posicao === "ACIMA" ? "acima" : "abaixo";
  if (c.percentual === null) return `${lado} do limite`;

  const abs = Math.abs(c.percentual);
  // Uma casa decimal basta. Duas dariam falsa precisão sobre medição de campo.
  const numero = abs >= 10 ? String(Math.round(abs)) : abs.toFixed(1).replace(".", ",");
  return `${numero}% ${lado} do limite`;
}

/**
 * O resultado declarado contradiz a aritmética?
 *
 * Não impede gravar: pode haver motivo — limite cadastrado errado, unidade
 * diferente, medição refeita. Mas contradição passando calada é pior que
 * contradição à vista.
 */
export function contradizComparacao(
  declarado: "ABAIXO_LIMITE" | "ACIMA_LIMITE" | "NAO_APLICAVEL" | null | undefined,
  c: ComparacaoComLimite
): boolean {
  if (!declarado || declarado === "NAO_APLICAVEL") return false;
  if (c.posicao === "INDETERMINADA" || c.posicao === "IGUAL") return false;
  return (
    (declarado === "ACIMA_LIMITE" && c.posicao === "ABAIXO") ||
    (declarado === "ABAIXO_LIMITE" && c.posicao === "ACIMA")
  );
}
