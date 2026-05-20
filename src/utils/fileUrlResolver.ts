
const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

// Mapeamento FIXO por contexto/tabela conforme solicitado
const TABLE_BUCKET_MAP: Record<string, string> = {
  "diario_fotos": "diario-fotos",
  "diario_campo_fotos": "diario-fotos",
  "contratos": "contratos",
  "profiles": "avatars",
  "timeline": "timeline-evidencias",
  "medicoes": "medicoes-pdf",
  "empresas": "medicao-capas",
  "clientes": "medicao-capas"
};

/**
 * Resolve uma URL de arquivo de forma robusta e contextual.
 * O bucket é decidido apenas pela tabela (contexto), nunca inferido pelo path.
 */
export function resolveFileUrl(
  path: string | null | undefined, 
  preserveThumbs = false, 
  context?: string
): string {
  if (!path || path.trim() === "") return "";
  
  let trimmedPath = path.trim();

  // 1. Se já for uma URL absoluta (externa ou R2 já completo), retorna sem alteração
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  // 2. Limpeza de caminhos e thumbnails
  // Remover segmentos de thumbs se não forem explicitamente solicitados
  if (!preserveThumbs) {
    const thumbSegments = ["/thumbs/600/", "/thumbs/300/", "/thumbs/900/", "/thumbs/", "/medium/", "/small/"];
    thumbSegments.forEach(seg => {
      if (trimmedPath.includes(seg)) {
        trimmedPath = trimmedPath.replace(seg, "/");
      }
    });
    
    // Tratamento para thumbs no início do path ou com regex para garantir cobertura
    trimmedPath = trimmedPath.replace(/\/+/g, "/"); // Normalizar barras duplas
  }

  // 3. Decidir o bucket baseado no contexto (tabela)
  let bucket = "";
  if (context && TABLE_BUCKET_MAP[context]) {
    bucket = TABLE_BUCKET_MAP[context];
  }

  // 4. Se o path contiver ".r2.dev", tratamos como R2
  if (trimmedPath.includes(".r2.dev")) {
    return trimmedPath.startsWith("/") ? `https://${trimmedPath.slice(1)}` : `https://${trimmedPath}`;
  }

  // 5. Construção da URL Final
  // Se tivermos um bucket e o path não começar com ele, adicionamos
  if (bucket) {
    // Remove o bucket do início do path se ele já estiver lá (para não duplicar)
    if (trimmedPath.startsWith(`${bucket}/`)) {
      trimmedPath = trimmedPath.slice(bucket.length + 1);
    }
    
    // Garantir que não estamos tratando UUID como bucket (objetivo 5)
    // Se o primeiro segmento for um UUID, ele deve ser mantido como pasta
    
    const fullPath = `${bucket}/${trimmedPath}`;
    console.log(`[RESOLVER] Context: ${context}, Bucket: ${bucket}, Original: ${path}, Result: ${fullPath}`);
    
    // Por padrão, se não for explicitamente R2, usamos Supabase Base (compatibilidade histórica)
    // A migração mudará os registros no banco para URLs R2 completas.
    return `${SUPABASE_BASE}/${fullPath}`;
  }

  // Fallback se não houver contexto: tratar como R2 public se for apenas path
  const cleanPath = trimmedPath.startsWith("/") ? trimmedPath.slice(1) : trimmedPath;
  return `${R2_PUBLIC_BASE_URL}/${cleanPath}`;
}

/**
 * Função legada mantida para compatibilidade de assinatura, mas refatorada para usar a nova lógica.
 */
export function normalizeLegacyStoragePath(path: string | null | undefined, context?: string): string {
  const url = resolveFileUrl(path, true, context);
  // Extrair o path relativo da URL gerada
  if (url.startsWith(SUPABASE_BASE)) {
    return url.replace(`${SUPABASE_BASE}/`, "");
  }
  if (url.startsWith(R2_PUBLIC_BASE_URL)) {
    return url.replace(`${R2_PUBLIC_BASE_URL}/`, "");
  }
  return path || "";
}
