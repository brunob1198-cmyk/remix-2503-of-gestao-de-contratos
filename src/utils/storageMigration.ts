import { supabase } from "@/integrations/supabase/client";
import { resolveFileUrl } from "./fileUrlResolver";

const R2_WORKER_URL = "https://obras-upload-api.brunob1198.workers.dev/";
const SUPABASE_STORAGE_BASE = "https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public";

export interface MigrationLog {
  id: string;
  tableName: string;
  columnName: string;
  oldValue: string;
  newValue: string;
  status: 'success' | 'error' | 'skipped' | 'verified';
  message?: string;
}

// Index para mapeamento: filename -> { bucket, filePath }
let storageIndex: Map<string, { bucket: string, filePath: string }> = new Map();

/**
 * Scan inicial dos buckets para criar índice
 */
export async function buildStorageIndex() {
  const buckets = [
    "diario-fotos",
    "contratos",
    "medicoes-pdf",
    "avatars",
    "timeline-evidencias",
    "medicao-capas",
    "diario-campo-fotos"
  ];
  
  storageIndex = new Map();
  console.log("[MIGRATION] Iniciando escaneamento recursivo de buckets Supabase...");
  
  async function listRecursive(bucket: string, path: string = "") {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(path, {
        limit: 1000
      });

      if (error) {
        console.error(`Erro ao listar bucket ${bucket} em ${path}:`, error.message);
        return;
      }
      
      if (!data) return;

      for (const item of data) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if (item.id) { // É um arquivo
          // Priorizamos o nome do arquivo para o index
          storageIndex.set(item.name, { bucket, filePath: fullPath });
        } else {
          // É uma pasta, recursão
          await listRecursive(bucket, fullPath);
        }
      }
    } catch (e) {
      console.error(`Exceção ao listar bucket ${bucket}:`, e);
    }
  }

  for (const bucket of buckets) {
    await listRecursive(bucket);
  }
  
  console.log(`[MIGRATION] Index construído com ${storageIndex.size} arquivos.`);
}

function isThumbnail(path: string): boolean {
  const lowercasePath = path.toLowerCase();
  return (
    lowercasePath.includes("/thumbs/") ||
    lowercasePath.includes("thumb_") ||
    lowercasePath.includes("/600/") ||
    lowercasePath.includes("/300/") ||
    lowercasePath.includes("/900/") ||
    lowercasePath.includes("/thumbs") ||
    lowercasePath.startsWith("thumbs/") ||
    lowercasePath.startsWith("thumb_") ||
    /\/(300|600|900)\//.test(lowercasePath) ||
    /^(300|600|900)\//.test(lowercasePath)
  );
}

/**
 * Busca o caminho real no storage usando o índice
 */
export function findRealStoragePath(pathOrUrl: string) {
  // Pega apenas o nome do arquivo final
  const parts = pathOrUrl.split("/");
  const filename = parts.pop();
  
  if (filename && storageIndex.has(filename)) {
    return storageIndex.get(filename);
  }

  // Tenta também com o penúltimo part se for UUID/file.jpg
  if (parts.length > 0) {
    const lastTwo = `${parts[parts.length-1]}/${filename}`;
    // Busca parcial no index
    for (const [key, value] of storageIndex.entries()) {
      if (value.filePath.endsWith(lastTwo)) {
        return value;
      }
    }
  }

  return null;
}

export function extractStorageInfo(pathOrUrl: string) {
  let cleaned = pathOrUrl.trim();
  
  // 1. Remover base do Supabase se presente
  if (cleaned.startsWith(SUPABASE_STORAGE_BASE)) {
    cleaned = cleaned.replace(`${SUPABASE_STORAGE_BASE}/`, "");
  }
  
  // 2. Tratar URLs do R2
  if (cleaned.includes(".r2.dev")) {
    try {
      const urlObj = new URL(cleaned);
      cleaned = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch (e) {}
  }

  cleaned = cleaned.replace(/\\/g, "/");

  // 3. Tentar encontrar via index antes de fazer o parser manual
  const foundInIndex = findRealStoragePath(cleaned);
  if (foundInIndex) {
    return {
      ...foundInIndex,
      isOriginal: !isThumbnail(cleaned)
    };
  }

  // 4. Parser manual como fallback
  if (cleaned.startsWith("uploads/")) {
    cleaned = `contratos/${cleaned}`;
  }

  const parts = cleaned.split("/").filter(p => p !== "");
  
  if (parts.length < 2) {
    return null;
  }

  let bucket = parts[0];
  let filePath = parts.slice(1).join("/");

  const legacyBucketsMap: Record<string, string> = {
    "diario_fotos": "diario-fotos",
    "diario_campo_fotos": "diario-campo-fotos",
    "medicao_capas": "medicao-capas",
    "medicoes_pdf": "medicoes-pdf",
    "dsl_uploads": "dsl-uploads",
    "timeline_evidencias": "timeline-evidencias"
  };

  if (legacyBucketsMap[bucket]) {
    bucket = legacyBucketsMap[bucket];
  } else if (bucket.includes("_")) {
    bucket = bucket.replace(/_/g, "-");
  }

  return {
    bucket,
    filePath,
    isOriginal: !isThumbnail(cleaned)
  };
}

export async function migrateFileToR2(pathOrUrl: string | null | undefined): Promise<{ 
  url: string; 
  status: 'success' | 'error' | 'skipped' | 'verified'; 
  message?: string;
}> {
  if (!pathOrUrl || pathOrUrl.trim() === "") {
    return { url: "", status: 'skipped', message: "Caminho vazio" };
  }

  const info = extractStorageInfo(pathOrUrl);
  
  if (!info) {
    if (pathOrUrl.startsWith("http") && !pathOrUrl.includes("supabase") && !pathOrUrl.includes("r2.dev")) {
      return { url: pathOrUrl, status: 'skipped', message: "URL externa ignorada" };
    }
    return { url: pathOrUrl, status: 'skipped', message: `Parser: Formato não reconhecido: ${pathOrUrl}` };
  }

  const { bucket, filePath, isOriginal } = info;

  if (!isOriginal) {
    return { url: pathOrUrl, status: 'skipped', message: `Thumbnail ignorada: ${filePath}` };
  }

  // Verificar se já existe no R2
  if (pathOrUrl.includes(".r2.dev")) {
    try {
      const checkRes = await fetch(pathOrUrl, { method: 'HEAD' });
      if (checkRes.ok) {
        return { url: pathOrUrl, status: 'verified', message: "Já existe no R2 (Verificado)" };
      }
    } catch (e) {}
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      console.log(`[MIGRATION] Tentando download: ${bucket}/${filePath}`);
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      
      if (error || !data) {
        const errorMsg = error?.message || "Arquivo não encontrado";
        if (errorMsg.includes("Object not found") || (error as any)?.status === 404 || errorMsg.includes("not found")) {
          return { 
            url: pathOrUrl, 
            status: 'skipped', 
            message: `404 no Supabase: ${bucket}/${filePath}` 
          };
        }

        if (attempt === maxAttempts - 1) {
          return { 
            url: pathOrUrl, 
            status: 'error', 
            message: `Erro download: ${errorMsg}` 
          };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const formData = new FormData();
      const fileName = filePath.split("/").pop() || "file";
      const file = new File([data], fileName, { type: data.type });
      formData.append("file", file);
      formData.append("path", `${bucket}/${filePath}`);

      const response = await fetch(R2_WORKER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (attempt === maxAttempts - 1) {
          return { url: pathOrUrl, status: 'error', message: `Erro R2: ${errorText}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const result = await response.json();
      if (!result.success) {
        return { url: pathOrUrl, status: 'error', message: result.error || "Falha R2" };
      }

      const newUrl = resolveFileUrl(result.url);
      
      // Validação final
      try {
        const verifyRes = await fetch(newUrl, { method: 'HEAD' });
        if (!verifyRes.ok) {
          return { 
            url: pathOrUrl, 
            status: 'error', 
            message: `Migrado, mas 404 no R2: ${newUrl}` 
          };
        }
      } catch (e) {}

      return { url: newUrl, status: 'success', message: `Sucesso! Path: ${bucket}/${filePath}` };
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        return { url: pathOrUrl, status: 'error', message: `Exceção: ${err.message}` };
      }
      attempt++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { url: pathOrUrl, status: 'error', message: "Esgotado" };
}

export async function migrateTableRecords(
  tableName: any, 
  idColumn: string,
  columnsToMigrate: string[],
  onProgress?: (log: MigrationLog) => void
) {
  const { data: records, error } = await supabase.from(tableName).select(`*`);

  if (error || !records) return;

  for (const record of records) {
    let updatedData: any = {};
    let hasChanges = false;

    for (const column of columnsToMigrate) {
      const oldValue = record[column];
      
      if (oldValue && typeof oldValue === 'string' && oldValue.trim() !== "") {
        const result = await migrateFileToR2(oldValue);
        
        if (result.status === 'success') {
          updatedData[column] = result.url;
          hasChanges = true;
        }

        if (onProgress) {
          onProgress({
            id: record[idColumn],
            tableName: String(tableName),
            columnName: column,
            oldValue,
            newValue: result.url,
            status: result.status,
            message: result.message
          });
        }
      }
    }

    if (hasChanges) {
      await supabase
        .from(tableName)
        .update(updatedData)
        .eq(idColumn, record[idColumn]);
    }
  }
}
