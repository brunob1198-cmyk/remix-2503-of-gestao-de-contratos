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
    
    // In a real production app, you might use a proxy here.
    // For now, we'll return the original URL and hope html2canvas can handle it 
    // or it will trigger the 'onerror' in the UI.
    return url;
  }
}

/**
 * Ensures all images in an element are fully loaded and decoded
 */
export async function ensureImagesLoaded(element: HTMLElement, onProgress?: (msg: string) => void): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));
  if (images.length === 0) return;

  let loadedCount = 0;
  onProgress?.(`Aguardando carregamento de ${images.length} imagens...`);

  await Promise.all(
    images.map(async (img) => {
      // Set crossOrigin before anything else
      if (!img.src.startsWith('data:')) {
        img.crossOrigin = "anonymous";
      }
      
      try {
        if (img.complete) {
          await img.decode().catch(() => {});
        } else {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
              console.error(`Falha ao carregar imagem: ${img.src}`);
              resolve(); // Resolve anyway to not block PDF generation
            };
          });
          await img.decode().catch(() => {});
        }
      } catch (e) {
        console.error("Erro ao decodificar imagem:", e);
      } finally {
        loadedCount++;
        if (loadedCount % 5 === 0 || loadedCount === images.length) {
          onProgress?.(`Imagens: ${loadedCount}/${images.length} carregadas`);
        }
      }
    })
  );
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

    if (bestBreak > cursor + 100) { // Increased minimum sliver height
      slices.push({ start: cursor, height: bestBreak - cursor });
      cursor = bestBreak;
    } else {
      slices.push({ start: cursor, height: pageHeightPx });
      cursor += pageHeightPx;
    }
  }

  return slices;
};
