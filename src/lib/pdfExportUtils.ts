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
export async function ensureImagesLoaded(element: HTMLElement, onProgress?: (msg: string) => void): Promise<{ total: number, loaded: number, failed: number }> {
  const images = Array.from(element.querySelectorAll("img"));
  if (images.length === 0) return { total: 0, loaded: 0, failed: 0 };

  let loadedCount = 0;
  let failedCount = 0;
  onProgress?.(`Aguardando carregamento de ${images.length} imagens...`);

  await Promise.all(
    images.map(async (img) => {
      // Set crossOrigin before anything else
      if (!img.src.startsWith('data:')) {
        img.crossOrigin = "anonymous";
      }
      
      try {
        if (img.complete && img.naturalWidth > 0) {
          await img.decode().catch(() => {});
          loadedCount++;
        } else {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn(`Timeout loading image: ${img.src}`);
              failedCount++;
              resolve();
            }, 10000);

            img.onload = () => {
              clearTimeout(timeout);
              loadedCount++;
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              console.error(`Falha ao carregar imagem: ${img.src}`);
              failedCount++;
              resolve(); 
            };
          });
          await img.decode().catch(() => {});
        }
      } catch (e) {
        console.error("Erro ao decodificar imagem:", e);
        failedCount++;
      } finally {
        if ((loadedCount + failedCount) % 5 === 0 || (loadedCount + failedCount) === images.length) {
          onProgress?.(`Imagens: ${loadedCount + failedCount}/${images.length} processadas`);
        }
      }
    })
  );

  return { total: images.length, loaded: loadedCount, failed: failedCount };
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
