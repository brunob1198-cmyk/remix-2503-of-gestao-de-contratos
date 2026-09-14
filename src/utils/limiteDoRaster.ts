/**
 * Até onde o navegador aguenta rasterizar um documento — e o que fazer quando
 * não aguenta.
 *
 * O DEFEITO QUE ISTO CORRIGE, E QUE FALHAVA EM SILÊNCIO
 *
 * Os documentos do SGSST são rasterizados: o `html2pdf` monta UM canvas com a
 * folha inteira, a 2×, e depois o fatia em páginas. Canvas tem teto de altura, e
 * ao passar dele o navegador não lança erro — devolve um canvas em branco.
 *
 * Medido no Chrome, pelo caminho real de emissão:
 *
 * |  páginas | altura do canvas | resultado                      |
 * |---------:|-----------------:|--------------------------------|
 * |       33 |           65.312 | 5,13 MB, com conteúdo          |
 * |       34 |           67.184 | 0,12 MB, TODAS EM BRANCO       |
 * |       60 |          118.560 | 0,15 MB, TODAS EM BRANCO       |
 *
 * O corte cai em 65.535 — o limite de dimensão de canvas do Chrome.
 *
 * E o arquivo continuava saindo. Pior: o timbre é estampado DEPOIS, pelo pdf-lib,
 * direto no PDF já paginado. O usuário recebia 36 páginas com logo, rodapé e
 * "Página 1 de 36", vazias por dentro — na lista de arquivos, um documento
 * perfeitamente normal. Um PGR de obra grande passa de 33 páginas com facilidade.
 *
 * A SAÍDA: BAIXAR A RESOLUÇÃO ANTES DE BATER NO TETO
 *
 * A escala multiplica os pixels do raster, não o layout. A 1,5× o mesmo documento
 * ocupa 3/4 da altura; a 1×, metade. O texto sai menos nítido, e sai INTEIRO —
 * que é infinitamente melhor que sair em branco.
 *
 * Acima do que 1× alcança, não há truque: aí a emissão recusa e diz por quê.
 * Recusar com explicação é o pior resultado aceitável; entregar folha em branco
 * sem avisar não é.
 *
 * Isto é medida de contenção, não a correção definitiva. A correção é emitir os
 * documentos do SGSST em PDF direto, sem raster — e aí o teto deixa de existir.
 */

/**
 * Resoluções tentadas, da melhor para a pior.
 *
 * 2× é o padrão dos documentos (~280 dpi depois de esticado para o A4). 1× é
 * ~140 dpi: texto mole, legível na tela e sofrível impresso. Abaixo disso o
 * documento não serve, e é melhor recusar.
 */
export const ESCALAS_DE_RASTER = [2, 1.5, 1] as const;

/**
 * Teto de ÁREA, em pixels.
 *
 * Separado do teto de altura porque são limites diferentes do navegador: um é a
 * maior dimensão de um lado, o outro é o total de pixels. Na largura destes
 * documentos (~1.400px) quem aperta primeiro é a altura, mas a conta precisa das
 * duas para não passar em falso numa folha mais larga (paisagem, por exemplo).
 */
export const AREA_MAXIMA_DE_CANVAS_PX = 250_000_000;

export interface DecisaoDoRaster {
  /** Resolução a usar. */
  escala: number;
  /** Verdadeiro quando foi preciso abrir mão da resolução padrão. */
  reduzida: boolean;
}

/**
 * A maior resolução com que este conteúdo ainda cabe num canvas.
 *
 * Devolve nulo quando nem a menor resolução cabe — e aí quem chama tem de
 * recusar a emissão, nunca seguir e torcer.
 */
export function decisaoDoRaster(params: {
  /** Altura do conteúdo já paginado, em pixels de CSS. */
  alturaConteudoPx: number;
  /** Largura do conteúdo, em pixels de CSS. */
  larguraConteudoPx: number;
  /** Maior altura de canvas que este navegador aceita. */
  tetoAlturaPx: number;
  tetoAreaPx?: number;
}): DecisaoDoRaster | null {
  const area = params.tetoAreaPx ?? AREA_MAXIMA_DE_CANVAS_PX;

  if (!(params.alturaConteudoPx > 0) || !(params.larguraConteudoPx > 0)) {
    // Conteúdo sem altura não tem o que medir; segue no padrão e o resultado
    // aparece na primeira página.
    return { escala: ESCALAS_DE_RASTER[0], reduzida: false };
  }

  for (const escala of ESCALAS_DE_RASTER) {
    const altura = params.alturaConteudoPx * escala;
    const largura = params.larguraConteudoPx * escala;
    if (altura <= params.tetoAlturaPx && altura * largura <= area) {
      return { escala, reduzida: escala !== ESCALAS_DE_RASTER[0] };
    }
  }

  return null;
}

/** Quantas páginas cabem numa dada resolução. Serve à mensagem de recusa. */
export function paginasQueCabem(params: {
  alturaDaPaginaPx: number;
  escala: number;
  tetoAlturaPx: number;
}): number {
  if (!(params.alturaDaPaginaPx > 0) || !(params.escala > 0)) return 0;
  return Math.floor(params.tetoAlturaPx / (params.alturaDaPaginaPx * params.escala));
}

/**
 * O que dizer a quem pediu um documento que não cabe.
 *
 * Diz o tamanho, o limite e o caminho de saída. "Erro ao gerar o PDF" mandaria o
 * usuário tentar de novo para sempre, porque a segunda tentativa falha igual.
 */
export function mensagemDeDocumentoLongoDemais(params: {
  paginasEstimadas: number;
  paginasSuportadas: number;
}): string {
  return (
    `Este documento tem cerca de ${params.paginasEstimadas} páginas e o navegador ` +
    `não consegue gerar um arquivo tão longo de uma vez — o limite aqui é de ` +
    `aproximadamente ${params.paginasSuportadas} páginas. ` +
    `Emita em partes (por período, por obra ou por seção) para que cada arquivo ` +
    `fique abaixo desse limite. Nada foi gerado.`
  );
}

/** Quantas páginas este conteúdo deve dar. Só para mensagem — não pagina nada. */
export function paginasEstimadas(alturaConteudoPx: number, alturaDaPaginaPx: number): number {
  if (!(alturaDaPaginaPx > 0)) return 0;
  return Math.max(1, Math.ceil(alturaConteudoPx / alturaDaPaginaPx));
}
