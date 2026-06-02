
const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

// Mapeamento FIXO por contexto/tabela conforme solicitado
const TABLE_BUCKET_MAP: Record<string, string> = {
  "diario_fotos": "diario-fotos",
  "diario_campo_fotos": "diario-fotos/campo",
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
  const isSupabaseUrl = trimmedPath.startsWith(SUPABASE_BASE);

  // 1. Se for uma URL absoluta, mas do Supabase, verificamos se o bucket está correto se houver contexto
  if (isSupabaseUrl && context && TABLE_BUCKET_MAP[context]) {
    const bucket = TABLE_BUCKET_MAP[context];
    const urlContent = trimmedPath.replace(`${SUPABASE_BASE}/`, "");
    const segments = urlContent.split("/");
    const currentBucket = segments[0];

    // Se o bucket atual for um UUID ou diferente do bucket esperado do contexto, forçamos a reconstrução
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentBucket);
    
    if (isUuid || currentBucket !== bucket.split('/')[0]) {
      console.log(`[RESOLVER] Corrigindo URL Supabase com bucket inválido (${currentBucket}). Contexto: ${context}`);
      // Se for UUID, o UUID é o início do path real (pasta da obra)
      trimmedPath = urlContent; 
    } else {
      return trimmedPath;
    }
  } else if (trimmedPath.startsWith("http://") || (trimmedPath.startsWith("https://") && !isSupabaseUrl)) {
    // URL externa não Supabase ou sem contexto para validar
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
  } else if (!context) {
     // Sem contexto, tentamos identificar se o path já começa com um bucket conhecido
     const knownBuckets = Object.values(TABLE_BUCKET_MAP).map(b => b.split('/')[0]);
     const uniqueBuckets = Array.from(new Set(knownBuckets));
     if (!uniqueBuckets.some(b => trimmedPath.startsWith(`${b}/`))) {
       console.warn(`[RESOLVER] Sem contexto e bucket não detectado: ${trimmedPath}`);
     }
  }

  // 4. Se o path contiver ".r2.dev", tratamos como R2
  if (trimmedPath.includes(".r2.dev")) {
    return trimmedPath.startsWith("/") ? `https://${trimmedPath.slice(1)}` : `https://${trimmedPath}`;
  }

  // 5. Construção da URL Final
  if (bucket) {
    // Remove o bucket do início do path se ele já estiver lá (para não duplicar)
    const bucketPrefix = bucket.split('/')[0];
    if (trimmedPath.startsWith(`${bucketPrefix}/`)) {
      trimmedPath = trimmedPath.slice(bucketPrefix.length + 1);
    }
    
    // Garantir que não estamos tratando UUID como bucket
    // Se o path começa com um UUID, mantemos como pasta
    
    const fullPath = `${bucket}/${trimmedPath.startsWith('/') ? trimmedPath.slice(1) : trimmedPath}`;
    console.log(`[RESOLVER] Context: ${context}, Bucket: ${bucket}, Original: ${path}, Result: ${fullPath}`);
    
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
