/**
 * Quando o texto do documento já não é o do catálogo.
 *
 * O DEFEITO QUE ISTO FECHA
 *
 * Roteiro 1.9: "Editar o nome de um risco do catálogo e abrir um documento que
 * já o citava → O texto novo aparece no documento."
 *
 * Não aparece, e isso é decisão tomada, não descuido — está escrita no próprio
 * formulário do inventário: "O limite é COPIADO, não referenciado: se o catálogo
 * mudar depois, este inventário não pode mudar retroativamente." Faz sentido: o
 * limite de tolerância que vale é o vigente na data da medição, e o `perigo` é
 * campo livre que a pessoa pode ter detalhado de propósito ("Ruído da serra do
 * pátio B" onde o catálogo diz apenas "Ruído").
 *
 * O QUE ESTÁ ERRADO EM QUALQUER UMA DAS DUAS POLÍTICAS
 *
 * A tela do PGR imprime as duas coisas, uma embaixo da outra e sem rótulo: o
 * `perigo` congelado em cima, e o nome VIVO do catálogo logo abaixo. Depois de
 * renomear no catálogo, a tela mostra o nome novo e o PDF sai com o velho — o
 * mesmo item, dois nomes, e nada dizendo qual vai para o papel.
 *
 * Quem faz o teste 1.9 olha a tela, vê o nome novo e conclui que passou.
 *
 * Isto não muda a política: só faz a divergência aparecer onde dá para agir.
 */

export interface DivergenciaDoCatalogo {
  /** O texto do catálogo difere do que o documento vai imprimir. */
  divergente: boolean;
  /** Frase pronta, vazia quando não há divergência. */
  aviso: string;
}

/** Compara ignorando caixa e espaços de sobra — "Ruído " e "ruído" são o mesmo nome. */
function mesmoTexto(a: string, b: string): boolean {
  const normal = (t: string) => t.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  return normal(a) === normal(b);
}

/**
 * O texto do documento ainda corresponde ao do catálogo?
 *
 * Sem vínculo com o catálogo não há divergência a apontar: o texto foi digitado,
 * e digitar é uma escolha legítima.
 */
export function divergenciaDoCatalogo(params: {
  /** O texto que o documento imprime — a cópia guardada no item. */
  textoDoDocumento?: string | null;
  /** O nome atual no catálogo, quando o item está vinculado. */
  nomeNoCatalogo?: string | null;
}): DivergenciaDoCatalogo {
  const doc = (params.textoDoDocumento ?? "").trim();
  const cat = (params.nomeNoCatalogo ?? "").trim();

  if (!doc || !cat || mesmoTexto(doc, cat)) {
    return { divergente: false, aviso: "" };
  }

  return {
    divergente: true,
    aviso:
      `O catálogo hoje diz "${cat}". O documento sai com "${doc}", que é o texto ` +
      `deste item — renomear no catálogo não reescreve o que já foi emitido.`,
  };
}
