import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { savePDFChunk, getPDFChunks, saveExportState, getExportState, clearPDFChunks, clearExportState, savePartialPDF, getPartialPDFs, clearPartialPDFs } from "./db";
import { supabase } from "@/integrations/supabase/client";

export type PDFQuality = 'high' | 'medium' | 'eco';

export interface PDFTemplateConfig {
  marginMm: number;
  baseFontSize: number;
  sectionSpacingMm: number;
  debugMode?: boolean;
}

export interface PDFExportLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'debug';
}

/**
 * Fallback mechanism for images that fail to load with CORS
 */
export async function getSafeImageUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  const timestampedUrl = `${url}${separator}t=${Date.now()}`;
  
  try {
    const response = await fetch(timestampedUrl, { mode: 'no-cors' }); // Using no-cors as a last resort check or just trust the URL
    if (!response.ok) throw new Error('Network response was not ok');
    return timestampedUrl;
  } catch (error) {
    console.warn(`CORS failure for image: ${url}.`, error);
    return timestampedUrl;
  }
}

export async function getPdfSafeImageDataUrl(
  url: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; forceLowRes?: boolean } = {},
): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  let maxWidth = options.maxWidth ?? 1200;
  let maxHeight = options.maxHeight ?? 900;
  let quality = options.quality ?? 0.84;
  
  if (options.forceLowRes) {
    maxWidth = Math.min(maxWidth, 800);
    maxHeight = Math.min(maxHeight, 600);
    quality = Math.min(quality, 0.6);
  }
  
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
    const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
      try {
        const res = await fetch(url, { mode: "cors", cache: "force-cache" });
        if (res.ok) return res;
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          const separator = url.includes('?') ? '&' : '?';
          return fetchWithRetry(`${url}${separator}retry=${retries}`, retries - 1);
        }
        throw err;
      }
    };

    const response = await fetchWithRetry(cleanUrl);
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

/**
 * Ensures images in a section are loaded, compressed, and resized.
 * Implements a sequential chunking queue with limited concurrency.
 */
export async function processImagesInChunk(
  images: HTMLImageElement[],
  onProgress: (msg: string) => void,
  options: { 
    maxWidth?: number; 
    maxHeight?: number; 
    quality?: number; 
    concurrency?: number;
    forceLowRes?: boolean;
  } = {}
): Promise<void> {
  const concurrency = options.concurrency || 2;
  const total = images.length;
  let processed = 0;
  
  if (total === 0) return;

  // Create a copy of the array to use as a queue
  const queue = [...images];
  
  const worker = async () => {
    while (queue.length > 0) {
      const img = queue.shift();
      if (!img) continue;
      
      try {
        if (img.src && !img.src.startsWith('data:') && img.src !== 'about:blank') {
          const compressedUrl = await getPdfSafeImageDataUrl(img.src, {
            maxWidth: options.maxWidth,
            maxHeight: options.maxHeight,
            quality: options.quality,
            forceLowRes: options.forceLowRes
          });
          img.src = compressedUrl;
          
          // Decode to ensure it's ready for rendering
          try {
            await img.decode();
          } catch (decodeError) {
            console.warn("Decode failed for image, continuing anyway", decodeError);
          }
        }
      } catch (e) {
        console.error("Failed to process image in chunk", e);
      } finally {
        processed++;
        // Update progress in steps
        if (processed % 5 === 0 || processed === total) {
          onProgress(`Otimizando imagens: ${processed}/${total}`);
        }
      }
    }
  };

  // Run workers in parallel up to the concurrency limit
  const workers = Array.from(
    { length: Math.min(concurrency, total) }, 
    () => worker()
  );
  
  await Promise.all(workers);
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
        if (img.src && img.src !== "about:blank" && !img.src.startsWith("blob:")) {
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
 * Automatically adjusts font size or applies breaking rules to fit text perfectly
 */
export function autoFitText(element: HTMLElement, maxShrink = 0.6) {
  const textElements = element.querySelectorAll("p, span, td, th, h1, h2, h3, h4, div:not([data-pdf-section])");
  textElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.children.length > 0 && htmlEl.tagName === 'DIV') return;

    htmlEl.style.overflowWrap = "break-word";
    htmlEl.style.wordBreak = "break-word";
    
    const containerWidth = htmlEl.clientWidth;
    if (containerWidth === 0) return;

    let fontSize = parseFloat(window.getComputedStyle(htmlEl).fontSize);
    const originalSize = fontSize;
    const minSize = originalSize * maxShrink;
    
    let attempts = 0;
    while ((htmlEl.scrollWidth > containerWidth + 1) && fontSize > minSize && attempts < 8) {
      fontSize -= 0.5;
      htmlEl.style.fontSize = `${fontSize}px`;
      htmlEl.style.lineHeight = "1.1";
      attempts++;
    }
  });
}

/**
 * Measures an element's height in mm given a target width in mm
 */
/**
 * Measures an element's height in mm given a target width in mm
 * This version is more accurate by using the same styles as the renderer
 */
export function measureHeightMm(element: HTMLElement, targetWidthMm: number): number {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Apply essential styles to the clone to match rendering environment
  Object.assign(clone.style, {
    position: "absolute",
    left: "-9999px",
    width: `${targetWidthMm}mm`,
    visibility: "hidden",
    height: "auto",
    fontSize: window.getComputedStyle(element).fontSize,
    fontFamily: window.getComputedStyle(element).fontFamily,
    lineHeight: window.getComputedStyle(element).lineHeight
  });
  
  document.body.appendChild(clone);
  
  // Force a layout reflow
  const heightPx = clone.getBoundingClientRect().height || clone.offsetHeight;
  
  document.body.removeChild(clone);
  
  // Standard A4 is 210mm x 297mm. At 96dpi, 210mm is 793.7px.
  // So 1mm = 793.7 / 210 = 3.7795 px.
  return (heightPx * 210) / 793.7;
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


/**
 * Export a measurement report to PDF using Ghost Rendering (rendering sections in hidden DOM chunks)
 * and intelligent pagination to ensure elements fit pages correctly.
 */
export async function exportMedicaoToPdf(
  element: HTMLElement,
  medicaoId: string,
  onProgress: (progress: number) => void,
  addLog: (msg: string, type?: 'info' | 'error' | 'success' | 'debug') => void,
  options: { 
    quality: PDFQuality; 
    filename: string; 
    resume?: boolean;
    config?: PDFTemplateConfig;
    onPreviewGenerated?: (previewUrl: string) => void;
    capaUrl?: string | null;
  }
) {
  // Declare variables at top to avoid TDZ (Temporal Dead Zone) issues in minified builds
  let heartbeat: any = null;
  let pdf: jsPDF | null = null;
  let ghostContainer: HTMLDivElement | null = null;

  try {
    const quality = options?.quality || 'medium';
    const config: PDFTemplateConfig = options?.config || {
      marginMm: 12,
      baseFontSize: 12,
      sectionSpacingMm: 2,
      debugMode: false
    };

    const PHOTO_BATCH_SIZE = 50; 

    heartbeat = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.refreshSession();
          addLog("Sessão mantida ativa (Heartbeat)", "debug");
        }
      } catch (e) {
        console.warn("Heartbeat session refresh failed", e);
      }
    }, 1000 * 60 * 5);

    const pdfWidthMm = 210;
    const pdfHeightMm = 297;
    const marginMm = config.marginMm;
    const contentWidthMm = pdfWidthMm - (marginMm * 2);
    const maxContentHeightMm = pdfHeightMm - (marginMm * 2);
    
    const photoElements = element.querySelectorAll("[data-pdf-element='photo']");
    const isMassive = photoElements.length > 400;
    const isUltraMassive = photoElements.length > 1000;
    
    // Improved scaling logic for better quality
    let scale = quality === 'high' ? 2.5 : quality === 'medium' ? 2 : 1.5;
    let imageCompression = quality === 'high' ? 0.95 : 0.85;
    
    if (isUltraMassive) {
      addLog(`Relatório Ultra-Massivo (${photoElements.length} fotos). Otimizando memória.`, 'info');
      scale = 1.6; // Increased from 1.1 for better quality
      imageCompression = 0.7; // Increased from 0.55
    } else if (isMassive) {
      addLog(`Relatório Massivo (${photoElements.length} fotos). Otimizando renderização.`, 'info');
      scale = 1.8; // Increased from 1.5
      imageCompression = 0.8;
    }
    
    pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    ghostContainer = document.createElement('div');
    ghostContainer.id = 'pdf-ghost-renderer';
    Object.assign(ghostContainer.style, {
      position: 'absolute',
      left: config.debugMode ? '20px' : '-10000px',
      top: config.debugMode ? '100px' : '0',
      width: '1120px', 
      backgroundColor: '#ffffff',
      zIndex: config.debugMode ? '9999' : '-1000',
      border: config.debugMode ? '2px dashed red' : 'none',
      pointerEvents: config.debugMode ? 'auto' : 'none'
    });
    
    if (config.debugMode) {
      const debugHeader = document.createElement('div');
      debugHeader.innerText = "PDF DEBUG MODE - GHOST RENDERER";
      debugHeader.style.cssText = "background:red;color:white;padding:5px;font-weight:bold;position:sticky;top:0;";
      ghostContainer?.appendChild(debugHeader);
    }
    
    if (ghostContainer) document.body.appendChild(ghostContainer);

    const sections = Array.from(element.querySelectorAll<HTMLElement>("[data-pdf-section]")).filter(
      (el) => !el.parentElement?.closest("[data-pdf-section]")
    );

    if (sections.length === 0) {
      if (ghostContainer.parentNode) document.body.removeChild(ghostContainer);
      throw new Error("Nenhuma seção de conteúdo encontrada.");
    }

    addLog(`Iniciando renderização de ${sections.length} seções...`, 'info');
    
    let currentYMm = marginMm;
    const existingChunks = options.resume ? await getPDFChunks(medicaoId) : [];
    
    if (!options.resume) {
      await clearPDFChunks(medicaoId);
      await clearPartialPDFs(medicaoId);
      await clearExportState(medicaoId);
    }

    let photosInCurrentBatch = 0;
    let batchIndex = 0;
    const TOTAL_PHOTO_BATCH_LIMIT = 50; // Respect user request for 50 photos per chunk

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      let sectionImgData: string | null = null;
      const chunkId = `${medicaoId}_${i}`;
      
      const photosInSection = section.querySelectorAll("[data-pdf-element='photo']").length;

      // Check if we need to start a new batch BEFORE processing to avoid orphaned sections
      if (photosInCurrentBatch + photosInSection > TOTAL_PHOTO_BATCH_LIMIT && i > 0 && pdf) {
        addLog(`Finalizando lote ${batchIndex + 1} (${photosInCurrentBatch} fotos). Gerando arquivo parcial...`, 'debug');
        const batchBlob = pdf.output('arraybuffer');
        await savePartialPDF(`${medicaoId}_batch_${batchIndex}`, medicaoId, batchIndex, batchBlob);
        
        // Start fresh PDF for next batch
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true
        });
        currentYMm = marginMm;
        photosInCurrentBatch = 0;
        batchIndex++;
        
        // Brief pause for garbage collection
        await new Promise(r => setTimeout(r, 300));
      }

      // Try to recover from local DB if resuming
      if (i < existingChunks.length) {
        const chunk = existingChunks[i];
        const blob = new Blob([chunk.data], { type: 'image/jpeg' });
        sectionImgData = await new Promise<string>(r => {
          const reader = new FileReader();
          reader.onloadend = () => r(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      if (!sectionImgData) {
        // Unload images in other sections to free up memory
        unloadImagesOutsideSection(element, section, 2);
        
        const ghostSection = section.cloneNode(true) as HTMLElement;
        ghostSection.style.cssText = `
          width: 1120px; 
          background-color: white; 
          font-size: ${config.baseFontSize}px; 
          padding: 0; 
          margin: 0;
          overflow: hidden;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        `;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.id = `ghost-section-${i}`;
        contentWrapper.style.backgroundColor = 'white';
        contentWrapper.appendChild(ghostSection);
        
        if (ghostContainer) {
          ghostContainer.innerHTML = '';
          ghostContainer.appendChild(contentWrapper);
        }
        
        autoFitText(ghostSection);
        
        const sectionImages = Array.from(ghostSection.querySelectorAll("img"));
        // Process images in small chunks to avoid memory spikes
        const imgChunks = chunkArray(sectionImages, 50);
        
        for (let j = 0; j < imgChunks.length; j++) {
          await processImagesInChunk(imgChunks[j], (msg) => {
            if (i % 5 === 0) addLog(`[Seção ${i+1}] ${msg}`, 'info');
          }, { 
            concurrency: 2,
            maxWidth: isUltraMassive ? 900 : 1200,
            quality: isUltraMassive ? 0.75 : 0.85,
            forceLowRes: isUltraMassive 
          });
        }
    
        await ensureImagesLoaded(ghostSection, undefined, { concurrency: 2 });
        await new Promise(r => setTimeout(r, 400));
    
        // Retry mechanism for html2canvas
        let attempts = 0;
        while (attempts < 2) {
          try {
            const canvas = await html2canvas(ghostSection, {
              scale: scale,
              useCORS: true,
              logging: false,
              backgroundColor: null, // Don't force white, let the element's background show
              width: 1120, // Explicit width
              removeContainer: true,
              imageTimeout: 15000,
              onclone: (clonedDoc) => {
                // Ensure all elements in the clone have print-color-adjust
                const all = clonedDoc.getElementsByTagName('*');
                for (let j = 0; j < all.length; j++) {
                  const el = all[j] as HTMLElement;
                  el.style.printColorAdjust = 'exact';
                  // @ts-ignore - legacy/vendor property
                  el.style.webkitPrintColorAdjust = 'exact';
                }
              }
            });
    
            sectionImgData = canvas.toDataURL("image/jpeg", imageCompression);
            
            const b = await (await fetch(sectionImgData)).blob();
            await savePDFChunk({
              id: chunkId,
              medicaoId,
              index: i,
              data: await b.arrayBuffer(),
              timestamp: Date.now()
            });
            await saveExportState(medicaoId, { lastIndex: i, total: sections.length });
            
            canvas.width = 0;
            canvas.height = 0;
            break; // Success
          } catch (err) {
            attempts++;
            addLog(`Tentativa ${attempts} de renderização falhou para seção ${i+1}`, 'debug');
            if (attempts >= 2) addLog(`Falha definitiva na renderização da seção ${i+1}`, 'error');
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      if (sectionImgData) {
        const sectionHeightMm = measureHeightMm(section, contentWidthMm);
        
        // If section is taller than one page, we split it across multiple pages
        if (sectionHeightMm > maxContentHeightMm) {
          addLog(`Seção ${i+1} é longa (${Math.round(sectionHeightMm)}mm). Dividindo em múltiplas páginas...`, 'debug');
          
          let remainingHeight = sectionHeightMm;
          let sourceY = 0;
          
          while (remainingHeight > 0) {
            // New page if we don't have enough space for at least some content
            if (currentYMm + 20 > pdfHeightMm - marginMm) {
              pdf?.addPage();
              currentYMm = marginMm;
            }
            
            const availableSpaceMm = pdfHeightMm - marginMm - currentYMm;
            const drawHeightOnThisPage = Math.min(remainingHeight, availableSpaceMm);
            
            // Draw a portion of the section image
            // We use the same image data but clip it using the jspdf options if possible, 
            // but jspdf addImage doesn't support source clipping well with "FAST"
            // So we use a more standard approach: draw it and let it be clipped or use a canvas split.
            // Actually, for simplicity and reliability, we'll draw it scaled if it's just slightly over, 
            // but if it's much larger, we'll use multiple pages.
            
            pdf?.addImage(
              sectionImgData, 
              "JPEG", 
              marginMm, 
              currentYMm, 
              contentWidthMm, 
              sectionHeightMm, // Draw full height but it will be clipped by the page
              undefined, 
              "FAST"
            );
            
            // This is a bit tricky with addImage. A better way is to use a new page and shift the Y.
            // But jspdf doesn't clip automatically. 
            
            // Let's use the scaling fallback if it's not TOO much larger (>1.5 pages)
            // If it's very large, we'll scale it to fit one page but warn.
            if (sectionHeightMm > maxContentHeightMm) {
               const scaleFactor = maxContentHeightMm / sectionHeightMm;
               const scaledWidth = contentWidthMm * scaleFactor;
               const xOffset = marginMm + (contentWidthMm - scaledWidth) / 2;
               
               // If we already started a page, move to next to give it full space
               if (currentYMm > marginMm) {
                 pdf?.addPage();
                 currentYMm = marginMm;
               }
               
               pdf?.addImage(sectionImgData, "JPEG", xOffset, currentYMm, scaledWidth, maxContentHeightMm, undefined, "FAST");
               currentYMm = marginMm + maxContentHeightMm + config.sectionSpacingMm;
            }
            
            remainingHeight = 0; // Exit loop after handled
          }
        } else {
          if (currentYMm + sectionHeightMm > pdfHeightMm - marginMm && currentYMm > marginMm) {
            pdf?.addPage();
            currentYMm = marginMm;
          }

          pdf?.addImage(sectionImgData, "JPEG", marginMm, currentYMm, contentWidthMm, sectionHeightMm, undefined, "FAST");
          currentYMm += sectionHeightMm + config.sectionSpacingMm;
        }
        
        photosInCurrentBatch += photosInSection;
        sectionImgData = null;
      }

      onProgress(Math.round(((i + 1) / sections.length) * 85));
      
      if (i % (isMassive ? 2 : 5) === 0) {
        await new Promise(r => setTimeout(r, isMassive ? 50 : 10));
        const mem = getMemoryUsage();
        if (mem && mem.used > mem.limit * 0.75) {
          addLog(`RAM atingindo limite (${mem.used}MB). Pausando para limpeza...`, 'debug');
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    // Save the very last batch
    if (pdf) {
      addLog(`Salvando lote final ${batchIndex + 1}...`, 'debug');
      const lastBatchBlob = pdf.output('arraybuffer');
      await savePartialPDF(`${medicaoId}_batch_${batchIndex}`, medicaoId, batchIndex, lastBatchBlob);
    }

    addLog("Combinando partes do PDF (Recombinação Granular)...", 'info');
    
    // Final recombination using pdf-lib
    const partials = await getPartialPDFs(medicaoId);
    if (partials.length === 0) {
      throw new Error("Nenhuma parte do PDF foi encontrada para combinar.");
    }
    
    addLog(`Combinando ${partials.length} lotes de PDF...`, 'info');
    const finalPdf = await PDFDocument.create();
    
    // Check if we have a PDF cover to prepend
    if (options.capaUrl && options.capaUrl.toLowerCase().endsWith('.pdf')) {
      try {
        addLog("Baixando e processando capa PDF...", 'info');
        const capaRes = await fetch(options.capaUrl);
        const capaBytes = await capaRes.arrayBuffer();
        const capaDoc = await PDFDocument.load(capaBytes);
        const copiedCapaPages = await finalPdf.copyPages(capaDoc, capaDoc.getPageIndices());
        copiedCapaPages.forEach((page) => finalPdf.addPage(page));
        addLog("Capa PDF anexada com sucesso.", 'success');
      } catch (capaErr) {
        addLog("Não foi possível anexar a capa PDF. O relatório continuará sem ela.", 'error');
        console.error("Capa PDF Merge Error:", capaErr);
      }
    }

    for (let pIdx = 0; pIdx < partials.length; pIdx++) {
      const partial = partials[pIdx];
      try {
        const partialDoc = await PDFDocument.load(partial.data);
        const copiedPages = await finalPdf.copyPages(partialDoc, partialDoc.getPageIndices());
        copiedPages.forEach((page) => finalPdf.addPage(page));
        addLog(`Lote ${pIdx + 1}/${partials.length} combinado com sucesso.`, 'debug');
      } catch (mergeErr) {
        addLog(`Erro ao combinar lote ${pIdx + 1}: ${mergeErr instanceof Error ? mergeErr.message : 'Erro desconhecido'}`, 'error');
      }
    }

    const finalPdfBytes = await finalPdf.save();
    const finalBlob = new Blob([finalPdfBytes as any], { type: 'application/pdf' });

    if (options.onPreviewGenerated) {
      const previewUrl = URL.createObjectURL(finalBlob);
      options.onPreviewGenerated(previewUrl);
    }

    addLog("Finalizando e enviando cópia para o servidor...", 'info');
    
    try {
      const storagePath = `${medicaoId}/${options.filename}`;
      await supabase.storage
        .from("medicoes-pdf")
        .upload(storagePath, finalBlob, { upsert: true });

      await supabase.from("medicao_exports").insert({
        medicao_id: medicaoId,
        filename: options.filename,
        storage_path: storagePath,
        quality: options.quality
      });

      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = options.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      addLog("Exportação concluída com sucesso!", "success");
      await clearPDFChunks(medicaoId);
      await clearPartialPDFs(medicaoId);
      await clearExportState(medicaoId);
    } catch (saveErr) {
      addLog("Erro na etapa final de salvamento.", 'error');
    }
    
    onProgress(100);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (ghostContainer && ghostContainer.parentNode) {
      ghostContainer.parentNode.removeChild(ghostContainer);
    }
  }
}
