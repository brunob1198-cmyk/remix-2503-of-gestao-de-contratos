import * as fflate from 'fflate';
import streamSaver from 'streamsaver';

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
}

/**
 * Exports a list of photos to a ZIP file using streaming to minimize memory usage.
 */
export async function exportPhotosToZip(
  photos: PhotoToZip[],
  zipFilename: string,
  options: ZipExportOptions = {}
) {
  const {
    concurrency = 3,
    onProgress,
    onLog
  } = options;

  const total = photos.length;
  let processed = 0;
  
  onLog?.(`Iniciando exportação de ${total} fotos para ZIP...`, 'info');

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
      onLog?.('Exportação concluída com sucesso!', 'success');
    }
  });

  // Helper to process one photo
  const processPhoto = async (photo: PhotoToZip) => {
    try {
      // 1. Fetch the image as a blob (direct to blob, no base64)
      const response = await fetch(photo.url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 2. Add to ZIP
      const path = photo.folder ? `${photo.folder}/${photo.filename}` : photo.filename;
      
      // fflate.ZipFile for streaming
      const zipFile = new fflate.ZipPassThrough(path);
      zipStream.add(zipFile);
      zipFile.push(uint8Array, true);

      // 3. Memory Cleanup
      // ArrayBuffer and Uint8Array will be GCed. 
      // Blob is not an ObjectURL here, so no revoke needed unless we used one.
      
      processed++;
      onProgress?.(processed, total);
      
      if (processed % 10 === 0 || processed === total) {
        onLog?.(`Processadas ${processed}/${total} fotos...`, 'info');
      }
    } catch (error) {
      onLog?.(`Erro ao processar foto ${photo.filename}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      // We continue with other photos even if one fails
    }
  };

  // Queue implementation for concurrency control
  const queue = [...photos];
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (queue.length > 0) {
      const photo = queue.shift();
      if (photo) {
        await processPhoto(photo);
      }
    }
  });

  try {
    await Promise.all(workers);
    zipStream.end();
  } catch (error) {
    onLog?.(`Erro fatal na exportação: ${error instanceof Error ? error.message : String(error)}`, 'error');
    writer.abort();
    throw error;
  }
}
