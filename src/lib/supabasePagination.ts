import { SupabaseClient } from "@supabase/supabase-js";

interface FetchAllOptions {
  pageSize?: number;      // default 1000
  maxPages?: number;      // default 20 (20k rows máximo)
  onProgress?: (loaded: number) => void;
}

/**
 * Utilitário para buscar todas as páginas de uma query do Supabase de forma segura,
 * com limite de páginas para evitar loops infinitos ou consumo excessivo de memória.
 */
export async function fetchAllPages<T>(
  queryBuilder: any,
  options: FetchAllOptions = {}
): Promise<T[]> {
  const { 
    pageSize = 1000, 
    maxPages = 20,
    onProgress 
  } = options;
  
  let all: T[] = [];
  let from = 0;
  let page = 0;

  while (page < maxPages) {
    const { data, error } = await queryBuilder
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    all = [...all, ...data];
    onProgress?.(all.length);
    
    if (data.length < pageSize) break;
    
    from += pageSize;
    page += 1;
  }

  if (page >= maxPages) {
    console.warn(
      `fetchAllPages: limite de ${maxPages * pageSize} registros atingido. Considere usar agregação no banco para este caso.`
    );
  }

  return all;
}
