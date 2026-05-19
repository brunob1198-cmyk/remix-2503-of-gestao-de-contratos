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

  const trimmed = pathOrUrl.trim();
  
  // 1. Identificar o path real no Supabase
  let supabasePath = "";
  if (trimmed.startsWith(SUPABASE_STORAGE_BASE)) {
    supabasePath = trimmed.replace(`${SUPABASE_STORAGE_BASE}/`, "");
  } else if (trimmed.includes(".r2.dev")) {
    const urlObj = new URL(trimmed);
    supabasePath = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    
    try {
      const checkRes = await fetch(trimmed, { method: 'HEAD' });
      if (checkRes.ok) {
        return { url: trimmed, status: 'verified', message: "Já existe no R2" };
      }
    } catch (e) {
      // Prossegue
    }
  } else if (!trimmed.startsWith("http")) {
    supabasePath = trimmed;
  } else {
    return { url: trimmed, status: 'skipped', message: "URL externa ignorada" };
  }

  // 2. Normalizar o path (remoção de thumbs, correção de buckets)
  if (supabasePath.includes("/thumbs/")) {
    supabasePath = supabasePath.replace(/\/thumbs\/(300|600|900)\//, "/");
  }

  if (supabasePath.startsWith("uploads/")) {
    supabasePath = `contratos/${supabasePath}`;
  }

  // Corrigir nomes de buckets com underscore para hifen (comum em erros de mapeamento)
  const legacyBucketsMap: Record<string, string> = {
    "diario_fotos": "diario-fotos",
    "diario_campo_fotos": "diario-campo-fotos",
    "medicao_capas": "medicao-capas",
    "medicoes_pdf": "medicoes-pdf",
    "dsl_uploads": "dsl-uploads",
    "timeline_evidencias": "timeline-evidencias"
  };

  const parts = supabasePath.split("/");
  let bucket = parts[0];
  let filePath = parts.slice(1).join("/");

  if (legacyBucketsMap[bucket]) {
    bucket = legacyBucketsMap[bucket];
    supabasePath = `${bucket}/${filePath}`;
  }

  if (!bucket || !filePath) {
    return { url: trimmed, status: 'error', message: `Path incompleto: ${supabasePath}` };
  }

  // 3. Tentar download do Supabase
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      console.log(`Tentando baixar do bucket: ${bucket}, path: ${filePath}`);
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      
      if (error || !data) {
        if (attempt === maxAttempts - 1) {
          return { url: trimmed, status: 'error', message: `Supabase 404/Erro: ${bucket}/${filePath}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // 4. Upload para R2
      const formData = new FormData();
      const fileName = parts[parts.length - 1];
      const file = new File([data], fileName, { type: data.type });
      formData.append("file", file);
      
      const response = await fetch(R2_WORKER_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (attempt === maxAttempts - 1) {
          return { url: trimmed, status: 'error', message: `Erro R2 Worker: ${response.status}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const result = await response.json();
      if (!result.success) {
        return { url: trimmed, status: 'error', message: result.error || "Falha R2" };
      }

      const newUrl = resolveFileUrl(result.url);
      return { url: newUrl, status: 'success', message: "Migrado com sucesso" };
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        return { url: trimmed, status: 'error', message: `Exceção: ${err.message}` };
      }
      attempt++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { url: trimmed, status: 'error', message: "Esgotado" };
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
      if (oldValue && typeof oldValue === 'string') {
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
      await supabase.from(tableName).update(updatedData).eq(idColumn, record[idColumn]);
    }
  }
}
