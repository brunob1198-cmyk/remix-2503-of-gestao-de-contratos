/**
 * Validação de contagem inteira positiva.
 *
 * Usada nos campos que contam coisas — quantidade padrão de EPI, periodicidade
 * de troca em meses. Fica separada do componente de célula editável porque a
 * regra é a mesma nos dois campos e repeti-la em cada chamada é como as duas
 * pontas param de concordar.
 */

/**
 * Devolve a mensagem de erro, ou `null` quando o texto serve.
 *
 * Quando `obrigatorio` é falso, vazio é válido e significa `null` no banco —
 * vazio não é zero: "sem troca programada" é uma decisão, zero mês seria um
 * prazo impossível.
 */
export function validarInteiroPositivo(obrigatorio: boolean, nome: string) {
  return (texto: string): string | null => {
    if (!texto) {
      return obrigatorio ? `Informe ${nome}.` : null;
    }

    // Aceita vírgula para não rejeitar em silêncio quem digita "1,0" — mas o
    // valor final tem de ser inteiro.
    const numero = Number(texto.replace(",", "."));
    if (!Number.isInteger(numero) || numero < 1) {
      return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} precisa ser um número inteiro maior que zero.`;
    }

    return null;
  };
}

/** Lê o texto já validado por `validarInteiroPositivo`. Vazio vira `null`. */
export function lerInteiroPositivo(texto: string): number | null {
  if (!texto) return null;
  return Number(texto.replace(",", "."));
}
