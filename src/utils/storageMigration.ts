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
  matchType?: string;
}

// Index para mapeamento global de arquivos
interface StorageIndexItem {
  bucket: string;
  filePath: string;
  filename: string;
  normalizedFilename: string;
}

let storageIndex: StorageIndexItem[] = [];

/**
 * Função utilitária para identificar thumbnails e arquivos derivados
 */
function isThumbnail(path: string): boolean {
  const lowercasePath = path.toLowerCase();
  return (
    lowercasePath.includes("/thumbs/") ||
    lowercasePath.includes("thumb_") ||
    lowercasePath.includes("/600/") ||
    lowercasePath.includes("/300/") ||
    lowercasePath.includes("/900/") ||
    lowercasePath.includes("/medium/") ||
    lowercasePath.includes("/small/") ||
    lowercasePath.includes("/thumbs") ||
    lowercasePath.startsWith("thumbs/") ||
    lowercasePath.startsWith("thumb_") ||
    /\/(300|600|900)\//.test(lowercasePath) ||
    /^(300|600|900)\//.test(lowercasePath)
  );
}

/**
 * Normaliza o nome do arquivo para comparação inteligente (Reconciliação)
 */
export function normalizeFileName(filename: string): string {
  if (!filename) return "";
  
  try {
    // Decodificar %20 e outros caracteres de URL
    let name = decodeURIComponent(filename);
    
    // Remover extensões (.jpeg, .jpg, .png, .pdf, .docx, etc.)
    name = name.replace(/\.[^/.]+$/, "");
    
    // Remover prefixos numéricos históricos comuns (ex: timestamps de 13 dígitos)
    name = name.replace(/^\d{10,13}(_|-| )/, "");
    
    // Normalização agressiva
    name = name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remover acentos
      .replace(/[^a-z0-9]/g, "") // Remover tudo que não for alfanumérico
      .trim();
      
    return name;
  } catch (e) {
    return filename.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}

/**
 * Scan inicial dos buckets para criar índice global em memória
 * Isso permite encontrar arquivos mesmo que o path no banco esteja incompleto.
 */
export async function buildStorageIndex() {
  const buckets = [
    "diario-fotos",
    "contratos",
    "medicoes-pdf",
    "avatars",
    "timeline-evidencias",
    "medicao-capas",
    "diario-campo-fotos",
    "empresas",
    "clientes"
  ];
  
  storageIndex = [];
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
        
        // Ignorar pastas de thumbnails e derivados durante o scan
        if (isThumbnail(fullPath)) continue;

        if (item.id) { // É um arquivo
          storageIndex.push({
            bucket,
            filePath: fullPath,
            filename: item.name,
            normalizedFilename: normalizeFileName(item.name)
          });
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
  
  console.log(`[MIGRATION] Index construído com ${storageIndex.length} arquivos reais.`);
}

/**
 * Busca o caminho real no storage usando reconciliação inteligente
 */
export function findRealStoragePath(pathOrUrl: string): { bucket: string, filePath: string, matchType: string } | null {
  if (!pathOrUrl) return null;

  // 1. Limpar e extrair o nome do arquivo original
  let cleaned = pathOrUrl.replace(/\\/g, "/");
  const parts = cleaned.split("/");
  const originalFilename = parts[parts.length - 1];
  const normalizedOriginal = normalizeFileName(originalFilename);

  if (!originalFilename) return null;

  // 2. Tentar Match Exato (Caminho completo ou final do path)
  for (const item of storageIndex) {
    if (cleaned.endsWith(item.filePath)) {
      return { bucket: item.bucket, filePath: item.filePath, matchType: 'exact' };
    }
  }

  // 3. Tentar Match por Nome de Arquivo Exato
  for (const item of storageIndex) {
    if (item.filename === originalFilename) {
      return { bucket: item.bucket, filePath: item.filePath, matchType: 'filename' };
    }
  }

  // 4. Tentar Match por Nome Normalizado (Inteligente)
  if (normalizedOriginal) {
    for (const item of storageIndex) {
      if (item.normalizedFilename === normalizedOriginal) {
        return { bucket: item.bucket, filePath: item.filePath, matchType: 'normalized' };
      }
    }
  }

  // 5. Match Fuzzy / Parcial (includes)
  for (const item of storageIndex) {
    if (item.filePath.includes(originalFilename) || cleaned.includes(item.filename)) {
      return { bucket: item.bucket, filePath: item.filePath, matchType: 'fuzzy' };
    }
  }

  return null;
}

export function extractStorageInfo(pathOrUrl: string, context?: string) {
  let cleaned = pathOrUrl.trim();
  
  // 1. Corrigir caminhos sem bucket usando o contexto antes de processar
  if (context) {
    cleaned = normalizeLegacyStoragePath(cleaned, context);
  }

  // 2. Remover base do Supabase se presente
  if (cleaned.startsWith(SUPABASE_STORAGE_BASE)) {
    cleaned = cleaned.replace(`${SUPABASE_STORAGE_BASE}/`, "");
  }
  
  // 3. Tratar URLs do R2
  if (cleaned.includes(".r2.dev")) {
    try {
      const urlObj = new URL(cleaned);
      cleaned = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch (e) {}
  }

  cleaned = cleaned.replace(/\\/g, "/");

  // 3. Tentar encontrar via index inteligente (Reconciliação)
  const foundInIndex = findRealStoragePath(cleaned);
  if (foundInIndex) {
    return {
      ...foundInIndex,
      isOriginal: !isThumbnail(cleaned)
    };
  }

  // 4. Parser manual como fallback para caminhos que podem não estar no index (ex: novos uploads)
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
    matchType: 'parser',
    isOriginal: !isThumbnail(cleaned)
  };
}

export async function migrateFileToR2(pathOrUrl: string | null | undefined, context?: string): Promise<{ 
  url: string; 
  status: 'success' | 'error' | 'skipped' | 'verified'; 
  message?: string;
  matchType?: string;
}> {
  if (!pathOrUrl || pathOrUrl.trim() === "") {
    return { url: "", status: 'skipped', message: "Caminho vazio" };
  }

  const info = extractStorageInfo(pathOrUrl, context);
  
  if (!info) {
    if (pathOrUrl.startsWith("http") && !pathOrUrl.includes("supabase") && !pathOrUrl.includes("r2.dev")) {
      return { url: pathOrUrl, status: 'skipped', message: "URL externa ignorada" };
    }
    return { url: pathOrUrl, status: 'skipped', message: `Parser: Formato não reconhecido` };
  }

  const { bucket, filePath, isOriginal, matchType } = info;

  if (!isOriginal) {
    return { url: pathOrUrl, status: 'skipped', message: `Thumbnail ignorada` };
  }

  // Verificar se já existe no R2 e está acessível
  if (pathOrUrl.includes(".r2.dev")) {
    try {
      const checkRes = await fetch(pathOrUrl, { method: 'HEAD' });
      if (checkRes.ok) {
        return { url: pathOrUrl, status: 'verified', message: "Já no R2", matchType: 'verified' };
      }
    } catch (e) {}
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      console.log(`[MIGRATION] [${matchType}] Tentando download: ${bucket}/${filePath}`);
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      
      if (error || !data) {
        const errorMsg = error?.message || "Arquivo não encontrado";
        if (errorMsg.includes("Object not found") || (error as any)?.status === 404) {
          return { 
            url: pathOrUrl, 
            status: 'skipped', 
            message: `404 no Supabase` 
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

      const newUrl = resolveFileUrl(result.url, false, context);
      
      // Validação final de existência no R2
      try {
        const verifyRes = await fetch(newUrl, { method: 'HEAD' });
        if (!verifyRes.ok) {
          return { 
            url: pathOrUrl, 
            status: 'error', 
            message: `Upload falhou na validação 404 R2` 
          };
        }
      } catch (e) {}

      return { 
        url: newUrl, 
        status: 'success', 
        message: `Sucesso! (${bucket}/${filePath})`,
        matchType
      };
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        return { url: pathOrUrl, status: 'error', message: `Exceção: ${err.message}` };
      }
      attempt++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { url: pathOrUrl, status: 'error', message: "Timeout/Esgotado" };
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
        const result = await migrateFileToR2(oldValue, String(tableName));
        
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
            message: result.message,
            matchType: result.matchType
          });
        }
      }
    }

    // Sempre verificar se o path original estava incompleto e precisa de saneamento no banco
    // Mesmo que não tenha migrado para o R2 (skipped), podemos sanear o path Supabase
    for (const column of columnsToMigrate) {
      const val = record[column];
      if (val && typeof val === 'string' && !val.includes('http') && !val.includes('.r2.dev')) {
        const normalized = normalizeLegacyStoragePath(val, String(tableName));
        if (normalized !== val) {
          updatedData[column] = normalized;
          hasChanges = true;
          console.log(`[SANITY] Saneando path no banco (${tableName}.${column}): ${val} -> ${normalized}`);
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