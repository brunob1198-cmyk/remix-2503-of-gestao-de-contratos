import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextoDoPdf } from "@/utils/ancoraDeAssinatura";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker as unknown as string;

/**
 * O texto de um PDF com onde cada pedaço está.
 *
 * Serve para achar, num documento que o usuário anexou, a linha da pessoa e a
 * coluna de assinatura — ver `posicaoDoCarimbo`.
 *
 * NÃO SERVE para os documentos que este sistema emite: o `html2pdf` rasteriza a
 * folha e insere uma imagem por página, então ali não há texto nenhum além do
 * rodapé. Esses trazem a posição medida na emissão, gravada no próprio arquivo.
 *
 * Está em módulo separado de propósito: o `pdfjs` é grande, e a tela pública de
 * assinatura não deve carregá-lo quando o documento já traz as posições.
 */
export async function extrairTextoComPosicao(bytes: ArrayBuffer): Promise<TextoDoPdf[]> {
  // `getDocument` consome o buffer; uma cópia evita que o mesmo ArrayBuffer usado
  // depois pelo pdf-lib chegue destacado ("detached").
  const copia = bytes.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: copia }).promise;

  const itens: TextoDoPdf[] = [];

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const conteudo = await pagina.getTextContent();

      for (const item of conteudo.items) {
        const texto = (item as { str?: string }).str ?? "";
        if (!texto.trim()) continue;

        // `transform` é a matriz do texto: os dois últimos valores são a posição,
        // no sistema do PDF — origem embaixo à esquerda, `y` crescendo para cima.
        const t = (item as { transform?: number[] }).transform ?? [];
        const x = t[4];
        const y = t[5];
        if (typeof x !== "number" || typeof y !== "number") continue;

        itens.push({
          texto,
          pagina: n - 1,
          x,
          y,
          largura: (item as { width?: number }).width ?? 0,
          altura: (item as { height?: number }).height ?? 0,
        });
      }
    }
  } finally {
    // Sem isso o worker do pdfjs fica vivo depois da leitura.
    await pdf.destroy();
  }

  return itens;
}
