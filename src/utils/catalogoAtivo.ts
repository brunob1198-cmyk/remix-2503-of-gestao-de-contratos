/**
 * O que um catálogo oferece para escolha.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Roteiro 1.8: "Inativar a função e ver a lista de funções de um novo
 * colaborador → A função inativa NÃO aparece para seleção."
 *
 * Funções e riscos têm `status` desde a criação das tabelas, e o formulário
 * permite inativar. Oito seletores consomem esses catálogos; **dois** filtravam
 * o inativo — o gerenciador de GHE e o vínculo de risco da função. Os outros
 * seis ofereciam tudo:
 *
 *   função ..... cadastro de colaborador, cadastro de treinamento, PCMSO
 *   risco ...... APR, NC de inspeção, inventário do PGR, incidente, PCMSO
 *
 * Inativar era decorativo em seis lugares de oito. Pior que não ter o campo:
 * quem inativa acredita ter tirado a função de circulação, e ela continua sendo
 * atribuída a gente nova.
 *
 * O QUE NÃO SE PODE FAZER: SUMIR COM O QUE JÁ FOI ESCOLHIDO
 *
 * Filtrar sem exceção quebra a edição. Um colaborador cadastrado há um ano com
 * uma função hoje inativa abriria o formulário com o seletor **em branco**, e
 * salvar gravaria o vazio por cima. Inativar significa "não ofereça isto para
 * escolhas novas", e nunca "apague o que já foi decidido".
 *
 * Por isso o item já selecionado permanece na lista, e vem rotulado — se ele
 * está ali e os outros inativos não, a pessoa precisa saber por quê.
 */

export interface ItemDeCatalogo {
  id: string;
  status?: string | null;
}

/** Inativo de verdade, e não "qualquer coisa diferente de ativo". */
export function estaInativo(item: { status?: string | null }): boolean {
  // Comparar contra "inativo", e não exigir `=== "ativo"`: a coluna é
  // `NOT NULL DEFAULT 'ativo'` com CHECK nos dois valores, então na prática dá no
  // mesmo — mas se um valor inesperado aparecer, esconder a linha é a falha pior.
  // Item de menos numa lista ninguém nota; item que some é procurado por horas.
  return (item.status ?? "").trim() === "inativo";
}

/**
 * Os itens que um seletor deve oferecer.
 *
 * Tira os inativos e mantém o que já está escolhido, para que abrir um registro
 * antigo não apague a escolha dele.
 */
export function itensParaSelecao<T extends ItemDeCatalogo>(
  itens: readonly T[] | null | undefined,
  selecionadoId?: string | null
): T[] {
  const selecionado = (selecionadoId ?? "").trim();

  return (itens ?? []).filter((item) => !estaInativo(item) || item.id === selecionado);
}

/**
 * O rótulo do item na lista, dizendo quando ele é um remanescente.
 *
 * Sem isto o item inativo preservado fica indistinguível dos ativos, e a pessoa
 * conclui que o filtro não funcionou — ou pior, escolhe-o de novo achando que
 * está em uso.
 */
export function rotuloDoItem(nome: string, item: { status?: string | null }): string {
  return estaInativo(item) ? `${nome} (inativo)` : nome;
}
