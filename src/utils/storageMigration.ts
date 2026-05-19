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
 * Retorna a nova URL se migrado com sucesso, ou a mesma URL se já estiver ok.
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
  
  // Identificar o path real no Supabase
  let supabasePath = "";
  if (trimmed.startsWith(SUPABASE_STORAGE_BASE)) {
    supabasePath = trimmed.replace(`${SUPABASE_STORAGE_BASE}/`, "");
  } else if (trimmed.includes(".r2.dev")) {
    // Se já é R2, precisamos verificar se o arquivo existe fisicamente.
    // Se não existir, tentamos recuperar do Supabase usando o mesmo path.
    const urlObj = new URL(trimmed);
    supabasePath = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    
    // Verificar se existe no R2 (opcional, mas recomendado pelo usuário)
    try {
      const checkRes = await fetch(trimmed, { method: 'HEAD' });
      if (checkRes.ok) {
        return { url: trimmed, status: 'verified', message: "Já existe no R2" };
      }
    } catch (e) {
      // Se falhar o HEAD, prosseguimos para tentar baixar do Supabase
    }
  } else if (!trimmed.startsWith("http")) {
    // É um path relativo
    supabasePath = trimmed;
  } else {
    // Outra URL absoluta (ex: Google)
    return { url: trimmed, status: 'skipped', message: "URL externa ignorada" };
  }

  // Corrigir nomes de buckets mapeados incorretamente ou caminhos legados
  if (supabasePath.startsWith("uploads/")) {
    supabasePath = `contratos/${supabasePath}`;
  } else if (supabasePath.startsWith("diario_fotos/")) {
    supabasePath = supabasePath.replace("diario_fotos/", "diario-fotos/");
  } else if (supabasePath.startsWith("diario_campo_fotos/")) {
    supabasePath = supabasePath.replace("diario_campo_fotos/", "diario-campo-fotos/");
  }

  // Tentar baixar do Supabase (com retry básico)
  const parts = supabasePath.split("/");
  let bucket = parts[0];
  const filePath = parts.slice(1).join("/");

  // Normalização adicional de buckets
  if (bucket === "diario_fotos") bucket = "diario-fotos";
  if (bucket === "diario_campo_fotos") bucket = "diario-campo-fotos";

  if (!bucket || !filePath) {
    return { url: trimmed, status: 'error', message: `Path inválido: ${supabasePath}` };
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(filePath);
      
      if (error || !data) {
        if (attempt === maxAttempts - 1) {
          return { url: trimmed, status: 'error', message: `Erro download Supabase: ${error?.message || "Sem dados"}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // Upload para R2 via Worker
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
          return { url: trimmed, status: 'error', message: `Erro upload R2: ${response.status} - ${errorText}` };
        }
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const result = await response.json();
      if (!result.success) {
        return { url: trimmed, status: 'error', message: result.error || "Falha upload R2" };
      }

      const newUrl = resolveFileUrl(result.url);
      return { url: newUrl, status: 'success', message: "Migrado com sucesso" };
    } catch (err: any) {
      if (attempt === maxAttempts - 1) {
        return { url: trimmed, status: 'error', message: `Erro inesperado: ${err.message}` };
      }
      attempt++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return { url: trimmed, status: 'error', message: "Falha após múltiplas tentativas" };
}

export async function migrateTableRecords(
  tableName: any, 
  idColumn: string,
  columnsToMigrate: string[],
  onProgress?: (log: MigrationLog) => void
) {
  // Buscar registros
  const { data: records, error } = await supabase
    .from(tableName)
    .select(`*`);

  if (error) {
    console.error(`Erro ao buscar dados de ${tableName}:`, error);
    return;
  }

  if (!records) return;

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
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updatedData)
        .eq(idColumn, record[idColumn]);

      if (updateError) {
        console.error(`Erro ao atualizar registro ${record[idColumn]} em ${tableName}:`, updateError);
      }
    }
  }
}

