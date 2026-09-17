/**
 * O que o navegador conclui da resposta de `guardar-documento-assinado`.
 *
 * POR QUE A LEITURA DA RESPOSTA É UM MÓDULO À PARTE
 *
 * O servidor devolve 409 em dois casos que parecem o mesmo e não são: quando o
 * documento JÁ ESTAVA guardado, e quando o banco recusou fechar a solicitação.
 * No primeiro, o arquivo pedido está lá e não há nada a corrigir — acontece
 * quando a resposta se perde no caminho e o navegador tenta de novo. No segundo,
 * o arquivo subiu mas a fila continua aberta.
 *
 * Ler os dois como erro faria a Central oferecer reparo para uma solicitação
 * inteira e correta — o mesmo tipo de conclusão errada que o reparo existe para
 * consertar.
 *
 * Separada do `fetch`, a regra pode ser testada sem rede e sem montar PDF.
 */

export interface CorpoDoServidor {
  ok?: boolean;
  erro?: string;
  url?: string;
  /** O servidor encontrou o documento já guardado e não gravou por cima. */
  jaExistia?: boolean;
}

export type LeituraDaResposta =
  | { tipo: "GUARDADO"; url: string }
  | { tipo: "FALHA"; erro: string };

export function leituraDaResposta(
  status: number,
  corpo: CorpoDoServidor | null
): LeituraDaResposta {
  const url = (corpo?.url ?? "").trim();

  // Documento que já estava lá: o status é de recusa, o resultado é o esperado.
  if (corpo?.jaExistia && url) return { tipo: "GUARDADO", url };

  if (status >= 200 && status < 300 && corpo?.ok && url) {
    return { tipo: "GUARDADO", url };
  }

  const erro = (corpo?.erro ?? "").trim();

  // Sem mensagem do servidor, o código HTTP é a única pista que sobra — e uma
  // falha sem pista nenhuma é a que o dono relatou: a tela não dizia por quê.
  return {
    tipo: "FALHA",
    erro: erro || `O servidor recusou o documento assinado (HTTP ${status}).`,
  };
}
