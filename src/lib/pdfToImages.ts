import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { openDB, type IDBPDatabase } from "idb";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker as unknown as string;

const CACHE_DB = "pdf_render_cache";
const CACHE_STORE = "pages";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface CacheEntry {
  id: string;
  pages: { name: string; blob: Blob }[];
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getCacheDb() {
  if (!dbPromise) {
    dbPromise = openDB(CACHE_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/** Chave estável do PDF: hash SHA-256 do conteúdo + escala de render. */
async function cacheKey(buffer: ArrayBuffer, scale: number): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}@${scale}`;
}

async function readCache(key: string): Promise<CacheEntry | null> {
  try {
    const db = await getCacheDb();
    const entry = (await db.get(CACHE_STORE, key)) as CacheEntry | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await db.delete(CACHE_STORE, key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(key: string, pages: { name: string; blob: Blob }[]) {
  try {
    const db = await getCacheDb();
    await db.put(CACHE_STORE, { id: key, pages, timestamp: Date.now() } as CacheEntry);
    // limpeza oportunista de entradas expiradas
    const all = (await db.getAll(CACHE_STORE)) as CacheEntry[];
    const expired = all.filter(e => Date.now() - e.timestamp > CACHE_TTL_MS);
    await Promise.all(expired.map(e => db.delete(CACHE_STORE, e.id)));
  } catch {
    /* cache é best-effort: quota cheia não deve quebrar o upload */
  }
}

/** Remove todo o cache de PDFs convertidos. */
export async function clearPdfImageCache() {
  try {
    const db = await getCacheDb();
    await db.clear(CACHE_STORE);
  } catch {
    /* noop */
  }
}

/**
 * Converte cada página de um PDF (ex: ART) em um arquivo JPEG.
 * Renderização local no browser — não consome banda/servidor.
 * Resultados ficam em cache (IndexedDB) por hash do arquivo, evitando reconverter.
 */
export async function pdfToImageFiles(file: File, scale = 2): Promise<File[]> {
  const buffer = await file.arrayBuffer();
  const baseName = file.name.replace(/\.pdf$/i, "");
  const key = await cacheKey(buffer, scale);

  const cached = await readCache(key);
  if (cached) {
    return cached.pages.map(p => new File([p.blob], p.name, { type: "image/jpeg" }));
  }

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: { name: string; blob: Blob }[] = [];

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

    pages.push({ name: `${baseName}-p${String(pageNum).padStart(2, "0")}.jpg`, blob });
  }

  await pdf.destroy();
  await writeCache(key, pages);

  return pages.map(p => new File([p.blob], p.name, { type: "image/jpeg" }));
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
