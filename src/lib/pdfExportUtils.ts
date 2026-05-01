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
  }
) {
  const quality = options.quality;
  const config: PDFTemplateConfig = options.config || {
    marginMm: 12,
    baseFontSize: 12,
    sectionSpacingMm: 2,
    debugMode: false
  };

  const PHOTO_BATCH_SIZE = 50; // Granular chunking every 50 photos for stability

  const heartbeat = setInterval(async () => {
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

  try {
    const pdfWidthMm = 210;
    const pdfHeightMm = 297;
    const marginMm = config.marginMm;
    const contentWidthMm = pdfWidthMm - (marginMm * 2);
    const maxContentHeightMm = pdfHeightMm - (marginMm * 2);
    
    const photoElements = element.querySelectorAll("[data-pdf-element='photo']");
    const isMassive = photoElements.length > 400;
    const isUltraMassive = photoElements.length > 1000;
    
    let scale = quality === 'high' ? 2.5 : quality === 'medium' ? 2 : 1.5;
    let imageCompression = quality === 'high' ? 0.95 : 0.85;
    
    if (isUltraMassive) {
      addLog(`Relatório Ultra-Massivo (${photoElements.length} fotos). Aplicando economia extrema de recursos.`, 'info');
      scale = 1.1; // Reduced from 1.2
      imageCompression = 0.55; // Reduced from 0.6
    } else if (isMassive) {
      addLog(`Relatório Massivo (${photoElements.length} fotos). Otimizando renderização.`, 'info');
      scale = Math.min(scale, 1.8);
      imageCompression = Math.min(imageCompression, 0.75);
    }
    
    let pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const ghostContainer = document.createElement('div');
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
      ghostContainer.appendChild(debugHeader);
    }
    
    document.body.appendChild(ghostContainer);

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

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      let sectionImgData: string | null = null;
      const chunkId = `${medicaoId}_${i}`;
      
      const photosInSection = section.querySelectorAll("[data-pdf-element='photo']").length;

      // Check if we need to start a new batch
      if (photosInCurrentBatch + photosInSection > PHOTO_BATCH_SIZE && i > 0) {
        addLog(`Finalizando lote ${batchIndex + 1} (${photosInCurrentBatch} fotos). Liberando memória...`, 'debug');
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
        
        // Brief pause for GC
        await new Promise(r => setTimeout(r, 200));
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
        unloadImagesOutsideSection(element, section, 1);
        
        const ghostSection = section.cloneNode(true) as HTMLElement;
        ghostSection.style.fontSize = `${config.baseFontSize}px`;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.id = `ghost-section-${i}`;
        contentWrapper.appendChild(ghostSection);
        
        if (config.debugMode) {
          ghostContainer.appendChild(contentWrapper);
        } else {
          ghostContainer.innerHTML = '';
          ghostContainer.appendChild(contentWrapper);
        }
        
        autoFitText(ghostSection);
        
        // Split section images into smaller chunks for granular processing
        const sectionImages = Array.from(ghostSection.querySelectorAll("img"));
        const imgChunks = chunkArray(sectionImages, 50);
        
        for (let j = 0; j < imgChunks.length; j++) {
          await processImagesInChunk(imgChunks[j], (msg) => {
            if (i % 5 === 0) addLog(`[Seção ${i+1}] ${msg}`, 'info');
          }, { 
            concurrency: 2, // Maximum 2 concurrent downloads
            maxWidth: isUltraMassive ? 800 : 1200,
            quality: isUltraMassive ? 0.6 : 0.8,
            forceLowRes: isUltraMassive 
          });
        }

        // Final safety check to ensure all are complete
        await ensureImagesLoaded(ghostSection, undefined, { concurrency: 2 });

        try {
          const canvas = await html2canvas(ghostSection, {
            scale: scale,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            width: ghostSection.offsetWidth,
            height: ghostSection.offsetHeight
          });

          sectionImgData = canvas.toDataURL("image/jpeg", imageCompression);
          
          const res = await fetch(sectionImgData);
          const b = await res.blob();
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
        } catch (err) {
          addLog(`Falha na renderização Ghost da seção ${i+1}`, 'error');
        }
      }

      if (sectionImgData) {
        let sectionHeightMm = measureHeightMm(section, contentWidthMm);
        let drawHeight = sectionHeightMm;
        let drawWidth = contentWidthMm;
        
        if (drawHeight > maxContentHeightMm) {
          const ratio = maxContentHeightMm / drawHeight;
          drawHeight = maxContentHeightMm;
          drawWidth = contentWidthMm * ratio;
        }

        if (currentYMm + drawHeight > pdfHeightMm - marginMm && currentYMm > marginMm) {
          pdf.addPage();
          currentYMm = marginMm;
        }

        const xOffset = marginMm + (contentWidthMm - drawWidth) / 2;
        pdf.addImage(sectionImgData, "JPEG", xOffset, currentYMm, drawWidth, drawHeight, undefined, "FAST");
        currentYMm += drawHeight + config.sectionSpacingMm;
        
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

    // Save final batch
    const lastBatchBlob = pdf.output('arraybuffer');
    await savePartialPDF(`${medicaoId}_batch_${batchIndex}`, medicaoId, batchIndex, lastBatchBlob);

    if (!config.debugMode && ghostContainer.parentNode) {
      document.body.removeChild(ghostContainer);
    }

    addLog("Combinando partes do PDF (Recombinação Granular)...", 'info');
    
    // Final recombination using pdf-lib
    const partials = await getPartialPDFs(medicaoId);
    const finalPdf = await PDFDocument.create();
    
    for (const partial of partials) {
      const partialDoc = await PDFDocument.load(partial.data);
      const copiedPages = await finalPdf.copyPages(partialDoc, partialDoc.getPageIndices());
      copiedPages.forEach((page) => finalPdf.addPage(page));
      addLog(`Parte ${partial.index + 1}/${partials.length} combinada.`, 'debug');
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
    clearInterval(heartbeat);
  }
}
