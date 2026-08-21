import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  aplicarPapelTimbrado,
  alturaPaginaEmPixels,
  cssMarcaDagua,
  opcoesPdfTimbrado,
  ORGANIZACAO_TIMBRE,
} from "@/lib/sgsstPapelTimbrado";

/**
 * O timbre é montado em duas etapas, e os testes cobrem as duas:
 *
 * - a MARCA D'ÁGUA é fundo CSS com `repeat-y`, e o que importa é o alinhamento
 *   do azulejo com a quebra de página — verificado pelas funções puras;
 * - LOGO, RODAPÉ e NUMERAÇÃO são estampados com pdf-lib no PDF pronto, e o que
 *   importa é que apareçam em TODA página, por cima do conteúdo.
 *
 * Roda em Node, sem navegador: `aplicarPapelTimbrado` recebe e devolve bytes.
 */

const RAIZ = resolve(__dirname, "../../../..");
const LOGO = resolve(RAIZ, "public/papel-timbrado/logo-aivx.png");
const MARCA = resolve(RAIZ, "public/papel-timbrado/marca-dagua.png");

/**
 * Serve os ativos do timbre do disco.
 *
 * O módulo os busca por `fetch` em caminho absoluto do site; em Node não há
 * servidor, então o stub mapeia a URL para o arquivo em `public/`.
 */
const fetchOriginal = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn(async (entrada: RequestInfo | URL) => {
    const url = String(entrada);
    const arquivo = url.includes("logo-aivx") ? LOGO : url.includes("marca-dagua") ? MARCA : null;

    if (!arquivo || !existsSync(arquivo)) {
      return { ok: false, status: 404 } as Response;
    }

    const bytes = readFileSync(arquivo);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer,
    } as Response;
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

/**
 * Embutir a marca d'água (236 KB) é a parte lenta; o timeout padrão de 5 s do
 * vitest não cobre isso quando a suíte inteira roda em paralelo.
 */
const TEMPO_PDF = 30_000;

/**
 * PDF de teste com o número de páginas pedido.
 *
 * Cada página recebe texto de propósito: página em branco não tem stream de
 * conteúdo, e o `embedPages` do pdf-lib recusa nesse caso. Um PDF vindo do
 * html2pdf sempre tem conteúdo, então o fixture precisa ser realista — foi assim
 * que a primeira versão destes testes falhou.
 */
async function pdfDeTeste(paginas: number): Promise<ArrayBuffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < paginas; i++) {
    const pagina = pdf.addPage([595, 842]); // A4 em pontos
    pagina.drawText(`CONTEUDO-ORIGINAL-PAGINA-${i + 1}`, {
      x: 60,
      y: 700,
      size: 11,
      font: fonte,
      color: rgb(0, 0, 0),
    });
  }

  const bytes = await pdf.save();
  // O cast é necessário porque `.buffer` é tipado como ArrayBufferLike, que
  // inclui SharedArrayBuffer — impossível aqui, mas o compilador não sabe.
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

/**
 * Texto desenhado no PDF, por página.
 *
 * Ler os bytes do arquivo direto não funciona: o stream de conteúdo vem
 * comprimido (Flate) e, dentro dele, o pdf-lib escreve o texto como string
 * HEXADECIMAL (`<4D41...> Tj`) e não como literal `(...)`. Então o caminho é
 * descomprimir o stream de cada página e converter o hexadecimal de volta.
 *
 * Vale o trabalho: é o que permite afirmar que TODA página foi estampada, que é
 * exatamente o que o timbre em CSS não conseguia garantir.
 */
async function textoPorPagina(bytes: Uint8Array): Promise<string[]> {
  const { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");

  const pdf = await PDFDocument.load(bytes);

  return pdf.getPages().map((pagina) => {
    const contents = pagina.node.Contents();
    if (!contents) return "";

    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];

    const bruto = refs
      .map((ref) => {
        const stream = pdf.context.lookup(ref);
        if (!(stream instanceof PDFRawStream)) return "";
        return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      })
      .join("\n");

    // Converte cada <hex> em texto; o resto do stream fica como está.
    return bruto.replace(/<([0-9A-Fa-f\s]+)>/g, (_, hex: string) =>
      Buffer.from(hex.replace(/\s/g, ""), "hex").toString("latin1")
    );
  });
}

/** Texto de todas as páginas concatenado. */
async function textoDesenhado(bytes: Uint8Array): Promise<string> {
  return (await textoPorPagina(bytes)).join("\n");
}

describe("ativos do papel timbrado", () => {
  it("o logo e a marca d'água estão no repositório", () => {
    // Se alguém remover os arquivos, o timbre degrada em silêncio (o módulo
    // trata falha de fetch como "sem logo"). Este teste torna a remoção visível.
    expect(existsSync(LOGO), `logo ausente em ${LOGO}`).toBe(true);
    expect(existsSync(MARCA), `marca d'água ausente em ${MARCA}`).toBe(true);
  });

  it("os dados da organização batem com o papel timbrado oficial", () => {
    expect(ORGANIZACAO_TIMBRE.cnpj).toBe("58.106.347/0001-01");
    expect(ORGANIZACAO_TIMBRE.site).toBe("aivxtech.com");
    expect(ORGANIZACAO_TIMBRE.email).toBe("aivx@aivxtech.com");
    expect(ORGANIZACAO_TIMBRE.telefone).toBe("(62) 3300-1148");
    expect(ORGANIZACAO_TIMBRE.endereco).toContain("Goiânia");
  });
});

describe("marca d'água como fundo CSS", () => {
  it("o azulejo tem a altura de uma página de conteúdo", () => {
    // A conta que faz a marca cair uma vez por folha. Área útil do A4 com as
    // margens do timbrado: 186 × 251 mm. A largura de render (1024 px) mapeia os
    // 186 mm, o que dá ~5,5054 px/mm; 251 mm nessa escala dão ~1381,9 px.
    //
    // Se alguém mexer nas margens sem revisar isto, a marca desalinha da quebra
    // de página e este teste cai.
    const altura = alturaPaginaEmPixels();
    expect(altura).toBeCloseTo((251 * 1024) / 186, 1);
    expect(altura).toBeGreaterThan(1300);
    expect(altura).toBeLessThan(1450);
  });

  it("o CSS repete verticalmente e usa a altura calculada", () => {
    const css = cssMarcaDagua();

    expect(css).toContain("repeat-y");
    expect(css).toContain("marca-dagua.png");
    // A altura no CSS tem de ser a mesma que a função calcula; divergir aqui era
    // o jeito silencioso de desalinhar a marca.
    expect(css).toContain(`${alturaPaginaEmPixels().toFixed(2)}px`);
    expect(css).toContain("top center");
  });

  it("a largura de render do CSS casa com a das opções do html2pdf", () => {
    // A escala px/mm do azulejo vem do `windowWidth`. Se os dois divergirem, a
    // marca desalinha — e nada mais avisaria.
    const opcoes = opcoesPdfTimbrado("x.pdf") as {
      html2canvas: { windowWidth: number };
      margin: number[];
    };

    const larguraUtilMm = 210 - opcoes.margin[1] - opcoes.margin[3];
    const alturaUtilMm = 297 - opcoes.margin[0] - opcoes.margin[2];
    const esperado = (alturaUtilMm * opcoes.html2canvas.windowWidth) / larguraUtilMm;

    expect(alturaPaginaEmPixels()).toBeCloseTo(esperado, 4);
  });

  it("mantém JPEG: PNG transparente pesava ~1,2 MB por página", () => {
    const opcoes = opcoesPdfTimbrado("x.pdf") as { image?: { type?: string } };
    // Sem `image` explícito vale o padrão do projeto, que é JPEG. O que não pode
    // voltar é o PNG que a versão anterior forçava.
    expect(opcoes.image?.type).not.toBe("png");
  });

  it("reserva margem para o logo e o rodapé estampados depois", () => {
    const opcoes = opcoesPdfTimbrado("x.pdf") as { margin: number[] };
    const [topo, dir, baixo, esq] = opcoes.margin;

    // Sem a reserva, a primeira linha da tabela sai embaixo do logo.
    expect(topo).toBeGreaterThanOrEqual(24);
    expect(baixo).toBeGreaterThanOrEqual(18);
    expect(dir).toBe(esq);
  });
});

describe("aplicarPapelTimbrado", () => {
  it("preserva a quantidade de páginas", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(3));
    const pdf = await PDFDocument.load(saida);
    expect(pdf.getPageCount()).toBe(3);
  }, TEMPO_PDF);

  it("estampa o rodapé em TODAS as páginas, não só na primeira", async () => {
    // É a razão de o timbre não ser feito em CSS: o html2pdf não repete rodapé.
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(3));
    const paginas = await textoPorPagina(saida);

    expect(paginas).toHaveLength(3);
    for (const [i, texto] of paginas.entries()) {
      expect(texto, `página ${i + 1} sem CNPJ no rodapé`).toContain("58.106.347/0001-01");
      expect(texto, `página ${i + 1} sem endereço`).toContain("Goi");
    }
  }, TEMPO_PDF);

  it("numera cada página com o seu próprio número", async () => {
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(3));
    const paginas = await textoPorPagina(saida);

    expect(paginas[0]).toContain("gina 1 de 3");
    expect(paginas[1]).toContain("gina 2 de 3");
    expect(paginas[2]).toContain("gina 3 de 3");
  }, TEMPO_PDF);

  it("repete a identificação do documento em todas as páginas", async () => {
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(2), {
      identificacao: "PGR OBRA-NORTE v3",
    });
    const paginas = await textoPorPagina(saida);

    for (const texto of paginas) expect(texto).toContain("PGR OBRA-NORTE v3");
  }, TEMPO_PDF);

  it("preserva o conteúdo original do documento", async () => {
    // O timbre desenha SOBRE o PDF recebido, sem remontar documento. Se o
    // conteúdo original sumisse, sairia uma folha timbrada e vazia — pior que
    // sem timbre.
    const paginas = await textoPorPagina(await aplicarPapelTimbrado(await pdfDeTeste(2)));

    expect(paginas[0]).toContain("CONTEUDO-ORIGINAL-PAGINA-1");
    expect(paginas[1]).toContain("CONTEUDO-ORIGINAL-PAGINA-2");
  }, TEMPO_PDF);

  it("o timbre é pintado DEPOIS do conteúdo, não antes", async () => {
    // Logo, rodapé e numeração são o timbre: precisam ficar visíveis sobre o
    // conteúdo. A marca d'água é o caso oposto e por isso saiu daqui — virou
    // fundo CSS, pintado pelo navegador antes do texto.
    const stream = (await textoPorPagina(await aplicarPapelTimbrado(await pdfDeTeste(1))))[0];

    const posConteudo = stream.indexOf("CONTEUDO-ORIGINAL-PAGINA-1");
    const posRodape = stream.indexOf("58.106.347/0001-01");

    expect(posConteudo).toBeGreaterThan(-1);
    expect(posRodape).toBeGreaterThan(-1);
    expect(posConteudo).toBeLessThan(posRodape);
  }, TEMPO_PDF);

  it("embute o logo uma vez e o referencia em cada página", async () => {
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(3));
    const paginas = await textoPorPagina(saida);

    // Os nomes de XObject do pdf-lib levam hífen (`/Image-7098480789`), então o
    // padrão precisa aceitá-lo — sem isso o teste não achava desenho nenhum.
    for (const [i, stream] of paginas.entries()) {
      const desenhos = [...stream.matchAll(/\/([A-Za-z0-9-]+)\s+Do\b/g)];
      expect(desenhos.length, `página ${i + 1} sem o logo`).toBeGreaterThanOrEqual(1);
    }
  }, TEMPO_PDF);

  it("gera documento válido mesmo se os ativos não puderem ser carregados", async () => {
    // Documento sem logo continua sendo documento válido. Derrubar a emissão
    // por causa da identidade visual seria trocar o essencial pelo acessório.
    const stubAnterior = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response) as typeof fetch;

    try {
      const { PDFDocument } = await import("pdf-lib");
      const saida = await aplicarPapelTimbrado(await pdfDeTeste(2));
      const pdf = await PDFDocument.load(saida);

      expect(pdf.getPageCount()).toBe(2);
      // O rodapé é texto, não imagem: continua saindo.
      expect((await textoDesenhado(saida))).toContain("58.106.347/0001-01");
    } finally {
      globalThis.fetch = stubAnterior;
    }
  }, TEMPO_PDF);

  it("aceita PDF de uma única página", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const saida = await aplicarPapelTimbrado(await pdfDeTeste(1));
    const pdf = await PDFDocument.load(saida);
    expect(pdf.getPageCount()).toBe(1);
    expect((await textoDesenhado(saida))).toContain("de 1");
  }, TEMPO_PDF);
});
