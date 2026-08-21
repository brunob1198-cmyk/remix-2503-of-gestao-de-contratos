import { getPdfOptions } from "@/lib/pdfTemplates";

/**
 * Papel timbrado dos documentos do SGSST.
 *
 * Os documentos saíam sem identidade visual: um PGR ou uma CAT impressa não
 * parecia documento da empresa, o que importa quando a folha vai para cliente,
 * seguradora ou fiscal.
 *
 * O timbre é aplicado com pdf-lib DEPOIS de o html2pdf gerar o PDF, e não em
 * CSS. O motivo é simples: o html2pdf quebra o conteúdo em páginas por conta
 * própria e não repete cabeçalho nem rodapé — um `background-image` no HTML sai
 * só na primeira página, ou cortado. Estampando página por página no PDF
 * pronto, TODA página recebe logo, rodapé e numeração.
 */

/** Dados da organização, transcritos do rodapé do papel timbrado oficial. */
export const ORGANIZACAO_TIMBRE = {
  site: "aivxtech.com",
  cnpj: "58.106.347/0001-01",
  endereco: "Rua C-152, n.478 — Jardim América, Goiânia – GO, 74.275-120",
  telefone: "(62) 3300-1148",
  email: "aivx@aivxtech.com",
} as const;

const LOGO_URL = "/papel-timbrado/logo-aivx.png";
const MARCA_DAGUA_URL = "/papel-timbrado/marca-dagua.png";

/** Proporção original do logo (2500 × 505), para não distorcer ao redimensionar. */
const LOGO_PROPORCAO = 505 / 2500;

/**
 * Margens em milímetros, maiores que as do PDF comum.
 *
 * O timbre é desenhado por cima do PDF já paginado, então o conteúdo precisa
 * nascer com espaço reservado — sem isso, a primeira linha da tabela fica
 * embaixo do logo.
 */
const MARGEM_SUPERIOR_MM = 26;
const MARGEM_INFERIOR_MM = 20;

const MM_PARA_PT = 72 / 25.4;

/** Cache por URL: o mesmo ativo é usado em toda emissão da sessão. */
const cacheAtivos = new Map<string, ArrayBuffer | null>();

/**
 * Busca um ativo do timbre.
 *
 * Devolve `null` em falha em vez de lançar: documento sem logo continua sendo
 * um documento válido, e derrubar a emissão por causa da identidade visual
 * seria trocar o essencial pelo acessório.
 */
async function buscarAtivo(url: string): Promise<ArrayBuffer | null> {
  if (cacheAtivos.has(url)) return cacheAtivos.get(url) ?? null;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const bytes = await resposta.arrayBuffer();
    cacheAtivos.set(url, bytes);
    return bytes;
  } catch {
    cacheAtivos.set(url, null);
    return null;
  }
}

export interface OpcoesTimbre {
  /** Texto curto identificando o documento, impresso no rodapé de cada página. */
  identificacao?: string;
  /** Inclui a marca d'água da marca ao fundo. Ligada por padrão. */
  marcaDagua?: boolean;
}

/**
 * Estampa logo, rodapé e numeração em todas as páginas de um PDF já gerado.
 *
 * Recebe e devolve bytes para poder ficar entre a geração e o download, sem que
 * cada documento precise saber como o timbre funciona.
 */
export async function aplicarPapelTimbrado(
  pdfBytes: ArrayBuffer,
  opcoes: OpcoesTimbre = {}
): Promise<Uint8Array> {
  // Import dinâmico: pdf-lib só é necessário na emissão, e não deve pesar o
  // bundle das telas que apenas listam documentos.
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdf = await PDFDocument.load(pdfBytes);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await buscarAtivo(LOGO_URL);
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : null;

  const marcaBytes =
    opcoes.marcaDagua === false ? null : await buscarAtivo(MARCA_DAGUA_URL);
  const marca = marcaBytes ? await pdf.embedPng(marcaBytes) : null;

  const paginas = pdf.getPages();
  const total = paginas.length;

  const tinta = rgb(0.12, 0.23, 0.37); // mesmo tom escuro dos documentos
  const tintaSuave = rgb(0.45, 0.5, 0.56);

  const margemLateral = 12 * MM_PARA_PT;

  paginas.forEach((pagina, indice) => {
    const { width, height } = pagina.getSize();

    // A marca d'água vai primeiro, para ficar atrás de tudo. O PDF do html2pdf
    // tem fundo branco opaco, então desenhar aqui a deixaria escondida — por
    // isso ela entra com opacidade baixa e o conteúdo permanece legível.
    if (marca) {
      const largura = width * 0.62;
      const altura = (largura * marca.height) / marca.width;
      pagina.drawImage(marca, {
        x: (width - largura) / 2,
        y: (height - altura) / 2,
        width: largura,
        height: altura,
        opacity: 0.06,
      });
    }

    if (logo) {
      const larguraLogo = 42 * MM_PARA_PT;
      const alturaLogo = larguraLogo * LOGO_PROPORCAO;
      pagina.drawImage(logo, {
        x: margemLateral,
        y: height - 12 * MM_PARA_PT - alturaLogo,
        width: larguraLogo,
        height: alturaLogo,
      });
    }

    // Linha fina separando o cabeçalho do conteúdo.
    const yLinha = height - MARGEM_SUPERIOR_MM * MM_PARA_PT + 4;
    pagina.drawLine({
      start: { x: margemLateral, y: yLinha },
      end: { x: width - margemLateral, y: yLinha },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    // ---- rodapé ----
    const yRodape = MARGEM_INFERIOR_MM * MM_PARA_PT - 6;

    pagina.drawLine({
      start: { x: margemLateral, y: yRodape + 22 },
      end: { x: width - margemLateral, y: yRodape + 22 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    const linha1 = `${ORGANIZACAO_TIMBRE.site}  ·  CNPJ ${ORGANIZACAO_TIMBRE.cnpj}  ·  ${ORGANIZACAO_TIMBRE.telefone}  ·  ${ORGANIZACAO_TIMBRE.email}`;
    const tamanho1 = 6.5;
    const largura1 = fonte.widthOfTextAtSize(linha1, tamanho1);
    pagina.drawText(linha1, {
      x: (width - largura1) / 2,
      y: yRodape + 12,
      size: tamanho1,
      font: fonte,
      color: tinta,
    });

    const linha2 = ORGANIZACAO_TIMBRE.endereco;
    const tamanho2 = 6;
    const largura2 = fonte.widthOfTextAtSize(linha2, tamanho2);
    pagina.drawText(linha2, {
      x: (width - largura2) / 2,
      y: yRodape + 3,
      size: tamanho2,
      font: fonte,
      color: tintaSuave,
    });

    // Numeração à direita e identificação do documento à esquerda: uma folha
    // solta que caiu do grampo precisa dizer de qual documento veio.
    const paginacao = `Página ${indice + 1} de ${total}`;
    const larguraPag = fonteNegrito.widthOfTextAtSize(paginacao, 6.5);
    pagina.drawText(paginacao, {
      x: width - margemLateral - larguraPag,
      y: yRodape + 26,
      size: 6.5,
      font: fonteNegrito,
      color: tintaSuave,
    });

    if (opcoes.identificacao) {
      pagina.drawText(opcoes.identificacao.slice(0, 90), {
        x: margemLateral,
        y: yRodape + 26,
        size: 6.5,
        font: fonte,
        color: tintaSuave,
      });
    }
  });

  return pdf.save();
}

/**
 * Opções do html2pdf para documento timbrado.
 *
 * Só difere do padrão nas margens: o timbre é estampado depois, e sem a reserva
 * de espaço o conteúdo passaria por baixo do logo e do rodapé.
 */
export function opcoesPdfTimbrado(nomeArquivo: string) {
  const base = getPdfOptions(nomeArquivo) as Record<string, unknown>;
  return {
    ...base,
    margin: [MARGEM_SUPERIOR_MM, 12, MARGEM_INFERIOR_MM, 12] as [
      number,
      number,
      number,
      number,
    ],
  };
}

/**
 * Gera o PDF de um HTML já montado, estampa o papel timbrado e baixa.
 *
 * Ponto único de emissão dos documentos do SGSST: quem escreve um documento novo
 * chama isto e ganha o timbre sem saber como ele é feito.
 */
export async function emitirPdfTimbrado(params: {
  html: string;
  nomeArquivo: string;
  identificacao?: string;
  marcaDagua?: boolean;
}): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");

  const container = document.createElement("div");
  container.innerHTML = params.html;

  // `outputPdf("arraybuffer")` em vez de `save()`: precisamos dos bytes para
  // estampar o timbre antes de entregar o arquivo.
  const bytes: ArrayBuffer = await html2pdf()
    .set(opcoesPdfTimbrado(params.nomeArquivo))
    .from(container)
    .outputPdf("arraybuffer");

  const timbrado = await aplicarPapelTimbrado(bytes, {
    identificacao: params.identificacao,
    marcaDagua: params.marcaDagua,
  });

  baixar(timbrado, params.nomeArquivo);
}

/** Entrega o arquivo ao usuário via link temporário. */
function baixar(bytes: Uint8Array, nomeArquivo: string): void {
  // `as unknown as BlobPart` porque o Uint8Array do pdf-lib carrega o tipo
  // genérico do ArrayBufferLike, que o lib.dom não aceita direto.
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libera o blob no próximo tick: revogar de imediato cancela o download em
  // alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
