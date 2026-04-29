import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export interface PDFExportLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

/**
 * Fallback mechanism for images that fail to load with CORS
 * Tries to fetch the image and convert to data URL
 */
export async function getSafeImageUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  
  // Add cache busting to avoid browser cache issues
  const separator = url.includes('?') ? '&' : '?';
  const timestampedUrl = `${url}${separator}t=${Date.now()}`;
  
  try {
    // Try to pre-fetch to check if CORS is okay
    const response = await fetch(timestampedUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Network response was not ok');
    
    // If we can fetch it, it's likely fine for html2canvas with useCORS: true
    return timestampedUrl;
  } catch (error) {
    console.warn(`CORS failure for image: ${url}. Attempting proxy/local fallback.`, error);
    
    // Fallback: try to convert to base64 if possible
    try {
      const resp = await fetch(url, { mode: 'no-cors' });
      // no-cors fetch doesn't allow reading body, so this is mostly to check existence
      // If we can't get a proper CORS response, we just return the original URL 
      // with cache busting and hope html2canvas handles it with useCORS: true
      return timestampedUrl;
    } catch (e) {
      return url;
    }
  }
}

export async function getPdfSafeImageDataUrl(
  url: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 900;
  const quality = options.quality ?? 0.84;
  const cleanUrl = (() => {
    try {
      const parsed = new URL(url, window.location.href);
      ["width", "height", "quality", "t", "pdf_export", "retry"].forEach((param) => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch {
      return url
        .replace(/([?&])(width|height|quality|t|pdf_export|retry)=[^&]*/g, "$1")
        .replace(/[?&]+$/, "");
    }
  })();

  const response = await fetch(cleanUrl, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Falha ao carregar imagem: HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) return cleanUrl;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return cleanUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Validates if a canvas has actual content (not just a blank white/transparent page)
 */
export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d');
  if (!context) return true;
  
  const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  
  // Check a sample of pixels for performance
  const step = 20; // Check every 20th pixel
  for (let i = 0; i < pixelData.length; i += 4 * step) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const a = pixelData[i + 3];
    
    // If not white and not transparent
    if (a > 0 && (r < 250 || g < 250 || b < 250)) {
      return false;
    }
  }
  return true;
}

/**
 * Ensures all images in an element are fully loaded and decoded
 */
const FALLBACK_IMAGE_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#f8fafc"/><text x="320" y="240" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-family="Arial" font-size="24">Imagem indisponível</text></svg>`
  );

export async function ensureImagesLoaded(
  element: HTMLElement,
  onProgress?: (msg: string) => void,
  options?: { images?: HTMLImageElement[]; concurrency?: number; timeoutMs?: number; label?: string }
): Promise<{ total: number, loaded: number, failed: number }> {
  const images = options?.images || Array.from(element.querySelectorAll("img"));
  if (images.length === 0) return { total: 0, loaded: 0, failed: 0 };

  let loadedCount = 0;
  let failedCount = 0;
  let cursor = 0;
  const concurrency = Math.max(1, options?.concurrency || 6);
  const timeoutMs = options?.timeoutMs || 30000;
  const label = options?.label || "Imagens";

  onProgress?.(`Aguardando carregamento de ${images.length} imagens${options?.label ? ` (${options.label})` : ""}...`);

  const loadOne = async (img: HTMLImageElement): Promise<boolean> => {
    if (!img.src) return false;
    if (img.dataset.pdfLoadFailed === "true") return false;
    if (!img.src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.loading = "eager";
    img.decoding = "async";

    if (img.complete && img.naturalWidth > 0) {
      await img.decode().catch(() => {});
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        if (!ok) {
          img.dataset.pdfLoadFailed = "true";
          img.src = FALLBACK_IMAGE_SRC;
        }
        resolve(ok);
      };
      const onLoad = () => finish(img.naturalWidth > 0);
      const onError = () => finish(false);
      const timeout = setTimeout(() => finish(false), timeoutMs);

      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
      const currentSrc = img.currentSrc || img.src;
      img.src = currentSrc;
    });
  };

  const worker = async () => {
    while (cursor < images.length) {
      const index = cursor++;
      const ok = await loadOne(images[index]);
      if (ok) loadedCount++;
      else failedCount++;
      const processed = loadedCount + failedCount;
      if (processed % 10 === 0 || processed === images.length) {
        onProgress?.(`${label}: ${processed}/${images.length} processadas`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, images.length) }, worker));

  return { total: images.length, loaded: loadedCount, failed: failedCount };
}

export function getImagesForSlice(
  element: HTMLElement,
  start: number,
  height: number,
  buffer = 600
): HTMLImageElement[] {
  const contentRect = element.getBoundingClientRect();
  return Array.from(element.querySelectorAll<HTMLImageElement>("img")).filter((img) => {
    const top = Number(img.dataset.pdfTop ?? NaN);
    const bottom = Number(img.dataset.pdfBottom ?? NaN);
    if (!Number.isNaN(top) && !Number.isNaN(bottom)) {
      return bottom >= start - buffer && top <= start + height + buffer;
    }
    const rect = img.getBoundingClientRect();
    const fallbackTop = rect.top - contentRect.top;
    const fallbackBottom = fallbackTop + rect.height;
    return fallbackBottom >= start - buffer && fallbackTop <= start + height + buffer;
  });
}

/**
 * Helper to split content into slices for reliable multi-page PDF generation
 */
export const collectSafeBreakPoints = (content: HTMLElement): number[] => {
  const contentRect = content.getBoundingClientRect();
  const sections = Array.from(content.querySelectorAll<HTMLElement>("[data-pdf-section]"))
    .filter((el) => !el.parentElement?.closest("[data-pdf-section]"));

  const breakPoints: number[] = [];
  for (const el of sections) {
    const rect = el.getBoundingClientRect();
    const top = Math.max(0, Math.floor(rect.top - contentRect.top));
    if (top > 0) breakPoints.push(top);
  }

  return [...new Set(breakPoints)].sort((a, b) => a - b);
};

export const buildPageSlices = (
  totalHeight: number,
  pageHeightPx: number,
  safeBreaks: number[],
): { start: number; height: number }[] => {
  const slices: { start: number; height: number }[] = [];
  let cursor = 0;

  while (cursor < totalHeight) {
    const remaining = totalHeight - cursor;

    if (remaining <= pageHeightPx) {
      slices.push({ start: cursor, height: remaining });
      break;
    }

    const pageEnd = cursor + pageHeightPx;
    let bestBreak = -1;

    for (const bp of safeBreaks) {
      if (bp <= cursor) continue;
      if (bp > pageEnd) break;
      bestBreak = bp;
    }

    if (bestBreak > cursor + 100) { 
      slices.push({ start: cursor, height: bestBreak - cursor });
      cursor = bestBreak;
    } else {
      slices.push({ start: cursor, height: pageHeightPx });
      cursor += pageHeightPx;
    }
  }

  return slices;
};
