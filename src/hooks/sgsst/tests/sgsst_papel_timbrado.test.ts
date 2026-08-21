import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { aplicarPapelTimbrado, ORGANIZACAO_TIMBRE } from "@/lib/sgsstPapelTimbrado";

/**
 * O timbre é aplicado com pdf-lib depois de o html2pdf gerar o PDF, e não em
 * CSS — o html2pdf pagina por conta própria e não repete cabeçalho nem rodapé.
 *
 * Esta suíte roda em Node, sem navegador: `aplicarPapelTimbrado` recebe e
 * devolve bytes, então dá para verificar de verdade que TODA página foi
 * estampada, que é justamente o que o CSS não conseguia garantir.
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

/** PDF de teste com o número de páginas pedido. */
async function pdfDeTeste(paginas: number): Promise<ArrayBuffer> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) pdf.addPage([595, 842]); // A4 em pontos
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

  it("embute imagens quando os ativos existem", async () => {
    const comImagens = await aplicarPapelTimbrado(await pdfDeTeste(1));
    const semMarca = await aplicarPapelTimbrado(await pdfDeTeste(1), { marcaDagua: false });

    // Com marca d'água o arquivo carrega uma imagem grande a mais.
    expect(comImagens.byteLength).toBeGreaterThan(semMarca.byteLength);
  }, TEMPO_PDF);

  it("marcaDagua: false não embute a marca", async () => {
    const semMarca = await aplicarPapelTimbrado(await pdfDeTeste(1), { marcaDagua: false });
    // O logo continua: só a marca d'água sai.
    expect((await textoDesenhado(semMarca))).toContain("58.106.347/0001-01");
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
