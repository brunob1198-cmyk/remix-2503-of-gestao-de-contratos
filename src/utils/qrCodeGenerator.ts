import QRCode from "qrcode";

/**
 * QR Code de verdade.
 *
 * O QUE ESTAVA AQUI ANTES
 *
 * Um DESENHO que imitava um QR Code. A funcao pintava os tres quadrados de canto,
 * um borrao 8x8 derivado de um hash do texto, um retangulo de borda e o rotulo
 * "VERIFICAR ASSINATURA" — e devolvia isso como PNG.
 *
 * Nao codificava nada. Nenhum leitor do mundo consegue ler aquilo, porque nao ha
 * o que ler: os pixels eram decorativos. O texto passado por parametro so
 * alimentava o hash que sorteava o borrao.
 *
 * Isso apareceu em dois lugares, e o segundo e o grave:
 *
 * 1. O QR Code do checklist, que o usuario tentou escanear no celular e nada
 *    aconteceu — foi assim que o defeito foi descoberto.
 *
 * 2. A FOLHA DE ASSINATURAS dos documentos assinados, que imprime ao lado dele
 *    "Escanear para verificar autenticidade no SaaS". Um documento de
 *    conformidade afirmando, em letra de forma, uma coisa que nao era verdade.
 *
 * O defeito sobreviveu porque ninguem nunca escaneou. Ele passa em qualquer
 * revisao visual: parece um QR Code. Por isso o teste deste modulo nao olha a
 * aparencia — ele DECODIFICA o resultado e confere que a URL volta inteira.
 */

/**
 * Correcao de erro em nivel M (~15%).
 *
 * O padrao da biblioteca e L (~7%). M porque estes codigos vao para o mundo
 * fisico: adesivo no para-brisa de um caminhao, placa num canteiro, papel que
 * amassa e suja. Sobe o tamanho do modulo um pouco e aguenta sujeira.
 */
const CORRECAO_DE_ERRO = "M" as const;

/** Sobra branca em volta, em modulos. Abaixo de 2 muitos leitores nao acham o codigo. */
const MARGEM_EM_MODULOS = 2;

/** Lado da imagem, em pixels. 512 imprime bem em adesivo pequeno. */
const LADO_PX = 512;

export interface OpcoesDoQrCode {
  /** Lado da imagem em pixels. */
  lado?: number;
  /** Cor dos modulos. Escura o bastante para contrastar com o fundo claro. */
  cor?: string;
}

/**
 * PNG (data URL) de um QR Code que realmente contem `texto`.
 *
 * Lanca quando o texto nao cabe num QR Code — nao devolve imagem decorativa em
 * nenhuma hipotese, porque entregar algo ilegivel com cara de valido foi
 * exatamente o defeito anterior.
 */
export async function generateQRCodeDataUrl(
  texto: string,
  opcoes: OpcoesDoQrCode = {}
): Promise<string> {
  if (!texto || !texto.trim()) {
    throw new Error("QR Code sem conteudo: nao ha o que codificar.");
  }

  return QRCode.toDataURL(texto, {
    errorCorrectionLevel: CORRECAO_DE_ERRO,
    margin: MARGEM_EM_MODULOS,
    width: opcoes.lado ?? LADO_PX,
    color: {
      dark: opcoes.cor ?? "#0F172A",
      light: "#FFFFFF",
    },
  });
}

/**
 * A matriz de modulos do QR Code: `true` = quadrado escuro.
 *
 * Existe para o teste poder DECODIFICAR o resultado sem depender de canvas nem
 * de leitor de PNG. E a mesma matriz que a imagem desenha, entao provar que ela
 * decodifica prova que a imagem e legivel.
 */
export function modulosDoQrCode(texto: string): { tamanho: number; escuro: boolean[] } {
  const qr = QRCode.create(texto, { errorCorrectionLevel: CORRECAO_DE_ERRO });
  const { size, data } = qr.modules;
  return {
    tamanho: size,
    // `data` e Uint8Array de 0/1 achatada, linha a linha.
    escuro: Array.from(data, (v) => v === 1),
  };
}
