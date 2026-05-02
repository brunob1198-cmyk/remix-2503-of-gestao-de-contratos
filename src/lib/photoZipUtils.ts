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
    concurrency = photos.length > 500 ? 2 : 3,
    onProgress,
    onLog,
    extraFiles = [],
    mainFolderName = '',
    medicaoId = '',
    resume = false
  } = options;

  // REMOVIDO: clearPhotoCache() automático para permitir persistência global
  // Só limpamos se explicitamente solicitado ou se houver erro crítico no futuro

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

        const path = file.filename;
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
async function validateImageUrl(url: string, timeout = 10000): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith('data:')) return true;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    // Simplificado: apenas um HEAD ou GET básico sem headers complexos que disparam CORS
    const response = await fetch(url, { 
      method: 'GET', 
      mode: 'cors', 
      signal: controller.signal,
    });
    
    clearTimeout(id);
    // Se o status for 200-299, está ok
    return response.ok;
  } catch (e) {
    console.warn(`Validação de URL falhou para ${url}:`, e);
    // Em caso de erro de rede/CORS na validação, retornamos true para tentar o download real
    // O download real tem lógica de retry e tratamento de erro mais robusto.
    return true; 
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
    // Cache key baseada na URL para permitir reutilização entre diferentes medições
    const cacheId = photo.url; 
    let blob: Blob | null = await getPhotoFromCache(cacheId);
    
    if (blob) {
      if (index % 50 === 0) onLog?.(`Recuperando ${photo.filename} do cache local...`, 'info');
    } else {
      // Tenta baixar diretamente com tratamento de erro robusto
      const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
        try {
          const res = await fetch(url, { 
            mode: 'cors', 
            cache: 'default',
          });
          if (res.ok) return res;
          
          // Se falhar por 403/401, pode ser que o URL precise de renovação ou o CORS esteja bloqueando
          if (res.status === 403 || res.status === 401) {
             throw new Error(`Acesso negado (Status ${res.status}). Verifique as permissões do bucket.`);
          }
          
          throw new Error(`Status ${res.status}`);
        } catch (err) {
          if (retries > 0) {
            const delay = 1500;
            await new Promise(r => setTimeout(r, delay));
            
            // Adiciona um cache-buster apenas no último retry
            const finalUrl = retries === 1 ? `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}` : url;
            return fetchWithRetry(finalUrl, retries - 1);
          }
          throw err;
        }
      };

      const response = await fetchWithRetry(photo.url);
      blob = await response.blob();
      
      if (!blob || blob.size < 100) {
        throw new Error("Arquivo baixado inválido ou muito pequeno.");
      }

      // Força a extensão para minúsculas para consistência com o HTML
      const ext = (photo.filename.split('.').pop() || 'jpg').toLowerCase();
      const baseName = photo.filename.substring(0, photo.filename.lastIndexOf('.'));
      const finalFileName = `${baseName}.${ext}`;

      // Verifica se é uma imagem ou se é algo que não deve estar no relatório fotográfico
      const contentType = blob.type || '';
      if (contentType.includes('pdf') || finalFileName.endsWith('.pdf')) {
        onLog?.(`Aviso: ${finalFileName} é um PDF e não será exibido como imagem no relatório.`, 'info');
      }
      
      await savePhotoToCache(cacheId, blob);
    }
    
    const arrayBuffer = await blob.arrayBuffer();
    uint8Array = new Uint8Array(arrayBuffer);
    blob = null; 

    // Simplificando estrutura: Fotos ficam em uma pasta flat se possível ou conforme definido
    // Mas sem o mainFolderName para evitar caminhos muito longos ou erros de aninhamento
    // Garante que o caminho não tenha barras duplas ou iniciais e que tudo esteja em minúsculo
    const folderPath = photo.folder ? photo.folder.toLowerCase().replace(/\/+$/, '') : '';
    const fullPath = folderPath ? `${folderPath}/${photo.filename.toLowerCase()}` : photo.filename.toLowerCase();
    
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
    
    // Cleanup cache REMOVIDO. Mantemos as fotos para futuras medições/re-gerações.
    // A limpeza deve ser manual pelo usuário se necessário.
    onLog?.(`Exportação finalizada. Cache mantido para otimizar futuras gerações.`, 'success');
  } catch (error) {
    onLog?.(`Erro fatal na exportação: ${error instanceof Error ? error.message : String(error)}`, 'error');
    writer.abort();
    throw error;
  }
}
