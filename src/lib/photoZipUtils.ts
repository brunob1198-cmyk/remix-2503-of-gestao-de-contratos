import * as fflate from 'fflate';
import streamSaver from 'streamsaver';
import { savePhotoToCache, getPhotoFromCache, clearPhotoCache } from './db';

export interface PhotoToZip {
  url: string;
  filename: string;
  folder?: string;
}

export interface ExtraFile {
  filename: string;
  content: string | Blob;
}

export interface ZipExportOptions {
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
  onLog?: (message: string, type: 'info' | 'success' | 'error') => void;
  extraFiles?: ExtraFile[];
  mainFolderName?: string;
  medicaoId?: string;
  resume?: boolean;
}

/**
 * Exports a measurement package to a ZIP file using streaming.
 * Includes photos, JSON data, and HTML report.
 */
export async function exportMedicaoCompletePackage(
  photos: PhotoToZip[],
  zipFilename: string,
  options: ZipExportOptions = {}
) {
  const {
    concurrency = photos.length > 500 ? 2 : 3, // Lower concurrency for large sets
    onProgress,
    onLog,
    extraFiles = [],
    mainFolderName = '',
    medicaoId = '',
    resume = false
  } = options;

  if (!resume) {
    await clearPhotoCache();
  }

  const total = photos.length + extraFiles.length;
  let processed = 0;
  
  onLog?.(`Iniciando exportação completa: ${photos.length} fotos e ${extraFiles.length} arquivos extras...`, 'info');

  // Create a writable stream for the ZIP file
  const fileStream = streamSaver.createWriteStream(zipFilename);
  const writer = fileStream.getWriter();

  // Create fflate ZIP stream with optimal compression for photos (none/low as they are already compressed)
  const zipStream = new fflate.Zip((err, data, final) => {
    if (err) {
      onLog?.(`Erro no stream do ZIP: ${err.message}`, 'error');
      return;
    }
    // Writing chunks to disk via StreamSaver
    writer.write(data);
    if (final) {
      writer.close();
      onLog?.('Pacote de medição concluído com sucesso!', 'success');
    }
  });

  // Helper to add extra files first (small files, fast)
  const addExtraFiles = async () => {
    for (const file of extraFiles) {
      try {
        let uint8Array: Uint8Array;
        if (typeof file.content === 'string') {
          uint8Array = new TextEncoder().encode(file.content);
        } else {
          const arrayBuffer = await file.content.arrayBuffer();
          uint8Array = new Uint8Array(arrayBuffer);
        }

        const path = mainFolderName ? `${mainFolderName}/${file.filename}` : file.filename;
        const zipFile = new fflate.ZipPassThrough(path);
        zipStream.add(zipFile);
        zipFile.push(uint8Array, true);
        
        processed++;
        onProgress?.(processed, total);
        onLog?.(`Arquivo adicionado: ${file.filename}`, 'info');
      } catch (error) {
        onLog?.(`Erro ao adicionar arquivo extra ${file.filename}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  };

/**
 * Validates if a URL is accessible before attempting to download.
 * Simplified to avoid issues with HEAD requests and CORS.
 */
async function validateImageUrl(url: string, timeout = 15000): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith('data:')) return true;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    // Try a simple GET with a range header to minimize data transfer if possible
    // Some servers might not support Range, so we fall back to a full GET if needed
    const response = await fetch(url, { 
      method: 'GET', 
      mode: 'cors', 
      signal: controller.signal,
      headers: { 'Range': 'bytes=0-10' } 
    }).catch(() => fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal }));
    
    clearTimeout(id);
    return response.ok || response.status === 206; // 206 is Partial Content
  } catch (e) {
    console.warn(`Validation failed for ${url}:`, e);
    // If validation fails due to CORS on GET, we might still want to try downloading 
    // because some browsers/environments behave differently for different fetch calls.
    // But for now, let's return false if we really can't reach it.
    return false;
  }
}

/**
 * Helper to process one photo with memory safety
 */
const processPhoto = async (
  photo: PhotoToZip, 
  index: number, 
  medicaoId: string, 
  resume: boolean, 
  zipStream: fflate.Zip,
  mainFolderName: string,
  onLog?: (msg: string, type: 'info' | 'success' | 'error') => void, 
  onProgress?: (p: number, t: number) => void, 
  total?: number, 
  processedRef?: { val: number }
) => {
  let uint8Array: Uint8Array | null = null;
  try {
    const cacheId = medicaoId ? `${medicaoId}_${photo.filename}` : photo.url;
    let blob: Blob | null = null;
    
    if (resume) {
      blob = await getPhotoFromCache(cacheId);
    }

    if (!blob) {
      const isValid = await validateImageUrl(photo.url);
      if (!isValid) {
        onLog?.(`Aviso: Foto ${photo.filename} está inacessível. Pulando...`, 'error');
        if (processedRef) processedRef.val++;
        if (onProgress && processedRef && total) onProgress(processedRef.val, total);
        return;
      }

      const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
        try {
          const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
          if (res.ok) return res;
          throw new Error(`Status ${res.status}`);
        } catch (err) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1500));
            const separator = url.includes('?') ? '&' : '?';
            return fetchWithRetry(`${url}${separator}retry=${retries}`, retries - 1);
          }
          throw err;
        }
      };

      const response = await fetchWithRetry(photo.url);
      blob = await response.blob();
      await savePhotoToCache(cacheId, blob);
    } else {
      if (index % 50 === 0) onLog?.(`Recuperando ${photo.filename} do cache local...`, 'info');
    }
    
    const arrayBuffer = await blob.arrayBuffer();
    uint8Array = new Uint8Array(arrayBuffer);
    blob = null; 

    let fullPath = photo.folder ? `${photo.folder}/${photo.filename}` : photo.filename;
    if (mainFolderName) {
      fullPath = `${mainFolderName}/${fullPath}`;
    }
    
    const zipFile = new fflate.ZipPassThrough(fullPath);
    zipStream.add(zipFile);
    zipFile.push(uint8Array, true);

    if (processedRef) {
      processedRef.val++;
      if (onProgress && total) onProgress(processedRef.val, total);
      
      if (processedRef.val % 20 === 0 || processedRef.val === total) {
        onLog?.(`Processados ${processedRef.val}/${total} arquivos...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } catch (error) {
    onLog?.(`Erro ao processar foto ${photo.filename}: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    uint8Array = null;
  }
};

  try {
    // 1. Add small files first (JSON, HTML)
    await addExtraFiles();

    // 2. Process photos with concurrency control
    const queue = [...photos];
    const processedRef = { val: processed };
    
    const workers = Array.from({ length: Math.min(concurrency, photos.length || 1) }, async () => {
      let localIndex = 0;
      while (queue.length > 0) {
        const photo = queue.shift();
        if (photo) {
          await processPhoto(
            photo, 
            localIndex++, 
            medicaoId, 
            resume, 
            zipStream, 
            mainFolderName,
            onLog, 
            onProgress, 
            total, 
            processedRef
          );
          if (localIndex % 20 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
    });

    await Promise.all(workers);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    zipStream.end();
    
    // Cleanup cache on success
    if (medicaoId) {
      // Small delay to ensure disk write is fully flushed
      setTimeout(async () => {
        try {
          await clearPhotoCache();
        } catch (e) {
          console.warn("Could not clear photo cache:", e);
        }
      }, 5000);
    }
  } catch (error) {
    onLog?.(`Erro fatal na exportação: ${error instanceof Error ? error.message : String(error)}`, 'error');
    writer.abort();
    throw error;
  }
}
