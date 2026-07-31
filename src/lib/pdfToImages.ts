import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error - worker é resolvido como URL pelo Vite
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker as unknown as string;

/**
 * Converte cada página de um PDF (ex: ART) em um arquivo JPEG.
 * Renderização local no browser — não consome banda/servidor.
 */
export async function pdfToImageFiles(file: File, scale = 2): Promise<File[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "");
  const out: File[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;

    await page.render({ canvas, canvasContext: context, viewport } as never).promise;

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) continue;

    out.push(
      new File([blob], `${baseName}-p${String(pageNum).padStart(2, "0")}.jpg`, {
        type: "image/jpeg",
      })
    );
  }

  await pdf.destroy();
  return out;
}

/** Expande uma lista de arquivos, convertendo PDFs em imagens e mantendo as imagens. */
export async function expandPdfsToImages(files: File[]): Promise<File[]> {
  const result: File[] = [];
  for (const file of files) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      result.push(...(await pdfToImageFiles(file)));
    } else {
      result.push(file);
    }
  }
  return result;
}
