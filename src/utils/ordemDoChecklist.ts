/**
 * A ordem das seções e dos itens do checklist.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Cada item guarda `ordem`, o formulário do modelo mantém esse número, e
 * ninguém o lia. As SEÇÕES eram ordenadas no documento; os ITENS, nunca — nem
 * no PDF, nem na tela de aplicação.
 *
 * O que decidia a ordem era o banco. A consulta pede
 * `itens:checklist_itens(*)` sem `order`, e o PostgREST devolve na ordem física
 * da tabela. Isso tem duas consequências, e a segunda é pior:
 *
 *   1. reordenar os itens no modelo não mudava nada em lugar nenhum;
 *   2. editar o modelo PODE mudar a ordem sozinho — atualizar uma linha a move
 *      no arquivo —, então a sequência do checklist muda sem ninguém pedir.
 *
 * Num checklist de campo a ordem não é estética: é a sequência em que a pessoa
 * percorre o equipamento. Trocar "testar o freio" com "soltar o macaco" muda o
 * que acontece na oficina.
 *
 * POR QUE UMA FUNÇÃO, E NÃO UM `sort` EM CADA TELA
 *
 * São seis pontos que percorrem seções e itens: o documento, a aplicação (em
 * quatro lugares) e o formulário do modelo. Espalhar a comparação por todos é
 * garantir que um fique para trás — que é exatamente como os itens ficaram sem
 * ordenação enquanto as seções tinham.
 */

export interface ItemOrdenavel {
  ordem?: number | null;
}

/**
 * `readonly` nas listas de propósito: os tipos do documento declaram
 * `readonly ItemDoDocumento[]`, e lista somente-leitura não serve onde se pede
 * uma mutável. Com a restrição exigindo array mutável o TypeScript desistia de
 * inferir o tipo real da seção e caía para esta interface — e o chamador perdia
 * `id`, `titulo` e todo o resto. Aqui dentro só se lê; exigir mutável não traz
 * nada e cobra caro.
 */
export interface SecaoOrdenavel {
  ordem?: number | null;
  itens?: readonly ItemOrdenavel[] | null;
}

/**
 * Compara por `ordem`, pondo quem não tem no fim.
 *
 * Item sem ordem no fim, e não no começo: o que chega sem número costuma ser o
 * acrescentado depois, e empurrá-lo para cima reembaralharia o que já estava
 * certo.
 */
function porOrdem(a: ItemOrdenavel, b: ItemOrdenavel): number {
  const na = a.ordem ?? Number.MAX_SAFE_INTEGER;
  const nb = b.ordem ?? Number.MAX_SAFE_INTEGER;
  return na - nb;
}

/** Os itens de uma seção, na ordem definida no modelo. */
export function itensOrdenados<I extends ItemOrdenavel>(
  itens?: readonly I[] | null
): I[] {
  return [...(itens ?? [])].sort(porOrdem);
}

/**
 * As seções na ordem definida, cada uma com os itens na ordem definida.
 *
 * Devolve cópias: ordenar no lugar mexeria no cache do React Query, que é
 * compartilhado, e a mesma lista apareceria reordenada em telas que não pediram
 * nada.
 */
export function secoesOrdenadas<S extends SecaoOrdenavel>(
  secoes?: readonly S[] | null
): S[] {
  return [...(secoes ?? [])]
    .sort(porOrdem)
    .map((secao) => ({ ...secao, itens: itensOrdenados(secao.itens) }));
}

/**
 * O tipo do item que uma seção carrega.
 *
 * Deduzido do próprio tipo da seção, e não recebido como segundo genérico: o
 * TypeScript não consegue inferir um parâmetro que só aparece na restrição de
 * outro, e cada chamada acabava com o item degradado para `ItemOrdenavel`.
 */
type ItemDaSecao<S> = S extends { itens?: readonly (infer I)[] | null } ? I : never;

/** Todos os itens do modelo, em ordem, achatados. */
export function itensDoModeloEmOrdem<S extends SecaoOrdenavel>(
  secoes?: readonly S[] | null
): ItemDaSecao<S>[] {
  return secoesOrdenadas(secoes).flatMap(
    (secao) => (secao.itens ?? []) as ItemDaSecao<S>[]
  );
}
