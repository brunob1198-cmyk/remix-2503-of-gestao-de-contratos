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

/**
 * Detecta se o path é de uma thumbnail histórica
 */
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
    // Regex para capturar padrões como 600/arquivo.jpg ou thumbs/600/
    /\/(300|600|900)\//.test(lowercasePath) ||
    /^(300|600|900)\//.test(lowercasePath)
  );
}

/**
 * Parser robusto para extrair bucket e path do arquivo
 */
export function extractStorageInfo(pathOrUrl: string) {
  let cleaned = pathOrUrl.trim();
  
  // 1. Remover base do Supabase se presente
  if (cleaned.startsWith(SUPABASE_STORAGE_BASE)) {
    cleaned = cleaned.replace(`${SUPABASE_STORAGE_BASE}/`, "");
  }
  
  // 2. Tratar URLs do R2 (se já migrado ou se for o domínio do R2)
  if (cleaned.includes(".r2.dev")) {
    try {
      const urlObj = new URL(cleaned);
      cleaned = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch (e) {
      // Se falhar o parse da URL, mantém o original
    }
  }

  // 3. Normalizar separadores
  cleaned = cleaned.replace(/\\/g, "/");

  // 4. Mapeamento de caminhos relativos órfãos
  // Se começa com uploads/, assume bucket contratos
  if (cleaned.startsWith("uploads/")) {
    cleaned = `contratos/${cleaned}`;
  }

  const parts = cleaned.split("/").filter(p => p !== "");
  
  if (parts.length < 2) {
    // Pode ser um arquivo na raiz de algum bucket não identificado?
    return null;
  }

  let bucket = parts[0];
  let filePath = parts.slice(1).join("/");

  // Corrigir nomes de buckets legados (convertendo _ para -)
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
    // Tenta converter automaticamente underscore para hifen se não estiver no mapa
    bucket = bucket.replace(/_/g, "-");
  }

  return {
    bucket,
    filePath,
    isOriginal: !isThumbnail(cleaned)
  };
}

/**
 * Tenta migrar um arquivo do Supabase para o R2.
 */
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
    // Se for uma URL externa que não é R2 nem Supabase, ignoramos sem erro
    if (pathOrUrl.startsWith("http") && !pathOrUrl.includes("supabase") && !pathOrUrl.includes("r2.dev")) {
      return { url: pathOrUrl, status: 'skipped', message: "URL externa ignorada" };
    }
    // Caso contrário, pode ser um erro de parser mas marcamos como skipped para não travar
    return { url: pathOrUrl, status: 'skipped', message: `Parser: Formato de caminho não reconhecido: ${pathOrUrl}` };
  }

  const { bucket, filePath, isOriginal } = info;

  // 1. Ignorar thumbnails
  if (!isOriginal) {
    return { url: pathOrUrl, status: 'skipped', message: `Thumbnail ignorada: ${filePath}` };
  }

  // 2. Verificar se já existe no R2
  if (pathOrUrl.includes(".r2.dev")) {
    try {
      const checkRes = await fetch(pathOrUrl, { method: 'HEAD' });
      if (checkRes.ok) {
        return { url: pathOrUrl, status: 'verified', message: "Já existe no R2 (Verificado)" };
      }
    } catch (e) {
      // Prossegue
    }
  }

  // 3. Tentar download do Supabase
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      console.log(`[MIGRATION] Bucket: ${bucket} | Path: ${filePath}`);
      
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      
      if (error || !data) {
        const errorMsg = error?.message || "Arquivo não encontrado";
        // Se o arquivo não existir, é um skip, não erro
        if (errorMsg.includes("Object not found") || (error as any)?.status === 404 || errorMsg.includes("not found")) {
          return { 
            url: pathOrUrl, 
            status: 'skipped', 
            message: `Arquivo não existe no Supabase (404). Bucket: ${bucket}, Path: ${filePath}` 
          };
        }

        if (attempt === maxAttempts - 1) {
          return { 
            url: pathOrUrl, 
            status: 'error', 
            message: `Erro Supabase (${bucket}/${filePath}): ${errorMsg}` 
          };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // 4. Upload para R2 via Worker
      const formData = new FormData();
      const fileName = filePath.split("/").pop() || "file";
      const file = new File([data], fileName, { type: data.type });
      formData.append("file", file);
      
      // Passar o path desejado para o Worker manter a estrutura
      formData.append("path", `${bucket}/${filePath}`);

      const response = await fetch(R2_WORKER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (attempt === maxAttempts - 1) {
          return { url: pathOrUrl, status: 'error', message: `Erro R2 Worker (${response.status}): ${errorText}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const result = await response.json();
      if (!result.success) {
        return { url: pathOrUrl, status: 'error', message: result.error || "Falha R2" };
      }

      // Validar URL retornada
      const newUrl = resolveFileUrl(result.url);
      
      // 5. Validação final: Verificar se o arquivo realmente está acessível no R2
      try {
        const verifyRes = await fetch(newUrl, { method: 'HEAD' });
        if (!verifyRes.ok) {
          return { 
            url: pathOrUrl, 
            status: 'error', 
            message: `Migrado para R2, mas retornou ${verifyRes.status} na verificação: ${newUrl}` 
          };
        }
      } catch (e) {
        // Ignora erro de rede na verificação
      }

      return { url: newUrl, status: 'success', message: `Migrado com sucesso! Bucket: ${bucket}, Path: ${filePath}` };
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        return { url: pathOrUrl, status: 'error', message: `Exceção: ${err.message}` };
      }
      attempt++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { url: pathOrUrl, status: 'error', message: "Esgotado após tentativas" };
}

export async function migrateTableRecords(
  tableName: any, 
  idColumn: string,
  columnsToMigrate: string[],
  onProgress?: (log: MigrationLog) => void
) {
  console.log(`[MIGRATION] Iniciando tabela: ${tableName}`);
  const { data: records, error } = await supabase.from(tableName).select(`*`);

  if (error || !records) {
    console.error(`[MIGRATION] Erro ao buscar registros da tabela ${tableName}:`, error);
    return;
  }

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
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updatedData)
        .eq(idColumn, record[idColumn]);
      
      if (updateError) {
        console.error(`[MIGRATION] Erro ao atualizar registro ${record[idColumn]} na tabela ${tableName}:`, updateError);
      }
    }
  }
}