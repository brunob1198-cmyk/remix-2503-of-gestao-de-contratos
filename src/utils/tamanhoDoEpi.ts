/**
 * O tamanho que o colaborador já tem cadastrado, na hora de entregar o EPI.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Calçado, camisa e calça eram coletados na ficha do trabalhador, apareciam na
 * lista, no detalhe e no dossiê — e não chegavam à tela de entrega, que tinha um
 * campo de texto livre em branco. Quem entrega digitava de memória, ou deixava
 * vazio.
 *
 * EPI de tamanho errado não é detalhe administrativo: bota folgada torce
 * tornozelo, cinturão grande não segura queda.
 *
 * POR QUE NÃO PREENCHER SEMPRE
 *
 * Só uma categoria mapeia sem ambiguidade: "Proteção dos Pés" é calçado. As
 * outras não — "Proteção do Corpo" cobre camisa, calça e macacão, e escolher uma
 * delas seria o sistema inventando um número que ninguém informou. É exatamente
 * o erro que este projeto já corrigiu em outros lugares.
 *
 * Então: preenche onde dá para saber, e MOSTRA o que está cadastrado onde não
 * dá. Quem entrega decide, com a informação à vista.
 */

export interface TamanhosDoColaborador {
  calcado?: string | null;
  camisa?: string | null;
  calca?: string | null;
}

const limpo = (v?: string | null) => (v ?? "").trim();

/**
 * Tamanho a sugerir para esta categoria de EPI, ou null quando o mapeamento não
 * é seguro.
 *
 * A comparação é pelo texto exato da categoria — é enumeração fechada no
 * `CategoriaEpi`, não texto livre.
 */
export function tamanhoSugerido(
  categoria: string | null | undefined,
  tamanhos: TamanhosDoColaborador | null | undefined
): string | null {
  if (!tamanhos) return null;

  if ((categoria ?? "").trim() === "Proteção dos Pés") {
    return limpo(tamanhos.calcado) || null;
  }

  return null;
}

/**
 * Os tamanhos cadastrados, prontos para exibir — ou null quando não há nenhum.
 *
 * Devolver "—" para tudo vazio encheria a tela de traço; sem nada cadastrado, o
 * certo é não ocupar espaço.
 */
export function resumoDosTamanhos(
  tamanhos: TamanhosDoColaborador | null | undefined
): string | null {
  if (!tamanhos) return null;

  const partes = [
    limpo(tamanhos.calcado) && `calçado ${limpo(tamanhos.calcado)}`,
    limpo(tamanhos.camisa) && `camisa ${limpo(tamanhos.camisa)}`,
    limpo(tamanhos.calca) && `calça ${limpo(tamanhos.calca)}`,
  ].filter(Boolean) as string[];

  return partes.length > 0 ? partes.join(" · ") : null;
}
