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
    concurrency = 3,
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

  // Create fflate ZIP stream
  const zipStream = new fflate.Zip((err, data, final) => {
    if (err) {
      onLog?.(`Erro no stream do ZIP: ${err.message}`, 'error');
      return;
    }
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

  // Helper to process one photo
  const processPhoto = async (photo: PhotoToZip) => {
    try {
      let blob: Blob | null = null;
      const cacheId = medicaoId ? `${medicaoId}_${photo.filename}` : photo.url;
      
      if (resume) {
        blob = await getPhotoFromCache(cacheId);
      }

      if (!blob) {
        const response = await fetch(photo.url, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
        
        // Save to cache for checkpointing
        await savePhotoToCache(cacheId, blob);
      } else {
        onLog?.(`Carregando ${photo.filename} do cache...`, 'info');
      }
      
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Add main folder and then subfolders
      let fullPath = photo.folder ? `${photo.folder}/${photo.filename}` : photo.filename;
      if (mainFolderName) {
        fullPath = `${mainFolderName}/${fullPath}`;
      }
      
      const zipFile = new fflate.ZipPassThrough(fullPath);
      zipStream.add(zipFile);
      zipFile.push(uint8Array, true);

      processed++;
      onProgress?.(processed, total);
      
      if (processed % 10 === 0 || processed === total) {
        onLog?.(`Processados ${processed}/${total} arquivos...`, 'info');
      }
    } catch (error) {
      onLog?.(`Erro ao processar foto ${photo.filename}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  try {
    // 1. Add small files first (JSON, HTML)
    await addExtraFiles();

    // 2. Process photos with concurrency control
    const queue = [...photos];
    const workers = Array.from({ length: Math.min(concurrency, photos.length || 1) }, async () => {
      while (queue.length > 0) {
        const photo = queue.shift();
        if (photo) {
          await processPhoto(photo);
        }
      }
    });

    await Promise.all(workers);
    zipStream.end();
    
    // Cleanup cache on success
    if (medicaoId) {
      await clearPhotoCache();
    }
  } catch (error) {
    onLog?.(`Erro fatal na exportação: ${error instanceof Error ? error.message : String(error)}`, 'error');
    writer.abort();
    throw error;
  }
}
