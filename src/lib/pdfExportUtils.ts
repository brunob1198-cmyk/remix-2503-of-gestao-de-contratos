import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export type PDFQuality = 'high' | 'medium' | 'eco';

export interface PDFExportLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

/**
 * Fallback mechanism for images that fail to load with CORS
 */
export async function getSafeImageUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  const timestampedUrl = `${url}${separator}t=${Date.now()}`;
  
  try {
    const response = await fetch(timestampedUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Network response was not ok');
    return timestampedUrl;
  } catch (error) {
    console.warn(`CORS failure for image: ${url}.`, error);
    return timestampedUrl;
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
  
  // Create a clean URL without resize params to get full quality before downsizing
  const cleanUrl = (() => {
    try {
      const parsed = new URL(url, window.location.href);
      ["width", "height", "quality", "t", "pdf_export", "retry"].forEach((param) => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch {
      return url.split('?')[0];
    }
  })();

  try {
    const response = await fetch(cleanUrl, { mode: "cors", cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
      
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      
      // Cleanup canvas immediately
      canvas.width = 0;
      canvas.height = 0;
      
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.error("Error processing image for PDF:", error);
    return cleanUrl;
  }
}

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

  const loadOne = async (img: HTMLImageElement): Promise<boolean> => {
    if (!img.src || img.src === "about:blank") return false;
    if (img.dataset.pdfLoadFailed === "true") return false;
    
    if (!img.src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.loading = "eager";
    img.decoding = "async";

    if (img.complete && img.naturalWidth > 0) {
      try {
        await img.decode();
        return true;
      } catch {
        // Continue to normal load listener if decode fails
      }
    }

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => finish(false), timeoutMs);
      
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

      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
      
      // Force reload if not already settled
      if (!img.complete) {
        const currentSrc = img.src;
        img.src = currentSrc;
      } else if (img.naturalWidth === 0) {
        finish(false);
      } else {
        finish(true);
      }
    });
  };

  const worker = async () => {
    while (cursor < images.length) {
      const index = cursor++;
      if (index >= images.length) break;
      
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

export function unloadImagesOutsideSection(content: HTMLElement, activeSection: HTMLElement, keepLoadedWindow = 5) {
  const sections = Array.from(content.querySelectorAll<HTMLElement>("[data-pdf-section]")).filter(
    (el) => !el.parentElement?.closest("[data-pdf-section]")
  );
  const activeIndex = sections.indexOf(activeSection);
  if (activeIndex === -1) return;

  sections.forEach((section, index) => {
    const isVisible = Math.abs(index - activeIndex) <= keepLoadedWindow;
    section.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (!isVisible) {
        if (img.src && img.src.startsWith("data:")) {
          img.dataset.src = img.src;
        }
        img.src = "about:blank"; // More memory efficient than empty string
      } else if (img.dataset.src && (!img.src || img.src === "about:blank")) {
        img.src = img.dataset.src;
      }
    });
  });
}

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: any;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Split an array into chunks
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Checks if an element's text content overflows its container
 */
export function checkTextOverflow(element: HTMLElement, debug = false): string[] {
  const overflows: string[] = [];
  const walk = (el: HTMLElement) => {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      const text = el.innerText?.substring(0, 30) || "unnamed";
      const info = `Overflow detected in ${el.tagName}.${el.className.replace(/\s+/g, '.')} (Text: "${text}")`;
      overflows.push(info);
      if (debug) {
        console.warn(`[PDF DEBUG] ${info}`, {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          element: el
        });
        el.style.outline = "2px solid red";
      }
    }
    Array.from(el.children).forEach(child => walk(child as HTMLElement));
  };
  walk(element);
  return overflows;
}

/**
 * Automatically adjusts font size or applies breaking rules to fit text
 */
export function autoFitText(element: HTMLElement) {
  const textElements = element.querySelectorAll("p, span, td, th, h1, h2, h3, h4, div");
  textElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Force breaking for very long strings without spaces
    htmlEl.style.overflowWrap = "break-word";
    htmlEl.style.wordBreak = "break-word";
    
    // Check for horizontal overflow and try to shrink font
    if (htmlEl.scrollWidth > htmlEl.clientWidth + 2) {
      let fontSize = parseFloat(window.getComputedStyle(htmlEl).fontSize);
      let attempts = 0;
      while (htmlEl.scrollWidth > htmlEl.clientWidth + 2 && fontSize > 6 && attempts < 5) {
        fontSize -= 0.5;
        htmlEl.style.fontSize = `${fontSize}px`;
        attempts++;
      }
    }
  });
}

/**
 * Measures an element's height in mm given a target width in mm
 */
export function measureHeightMm(element: HTMLElement, targetWidthMm: number): number {
  const clone = element.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    position: "absolute",
    left: "-9999px",
    width: `${targetWidthMm}mm`,
    visibility: "hidden",
    height: "auto"
  });
  document.body.appendChild(clone);
  const heightPx = clone.offsetHeight;
  document.body.removeChild(clone);
  
  // 1mm is approx 3.7795275591 px (standard 96dpi)
  return (heightPx * 25.4) / 96;
}

/**
 * Checks current memory usage if available
 */
export function getMemoryUsage() {
  if (typeof window !== "undefined" && (window.performance as any)?.memory) {
    const mem = (window.performance as any).memory;
    return {
      used: Math.round(mem.usedJSHeapSize / 1048576),
      total: Math.round(mem.totalJSHeapSize / 1048576),
      limit: Math.round(mem.jsHeapSizeLimit / 1048576),
    };
  }
  return null;
}


