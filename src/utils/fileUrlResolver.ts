
const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

/**
 * Normaliza caminhos de storage legados que podem não ter o bucket no path.
 * 
 * @param path O caminho ou URL a ser normalizado
 * @param context O contexto (geralmente o nome da tabela) para inferir o bucket
 */
export function normalizeLegacyStoragePath(path: string | null | undefined, context?: string): string {
  if (!path || path.trim() === "") return "";
  
  let trimmedPath = path.trim();
  
  // Se já for uma URL absoluta, não mexemos
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  // Buckets conhecidos do Supabase
  const supabaseBuckets = [
    "diario-fotos",
    "diario-campo-fotos",
    "timeline-evidencias",
    "avatars",
    "medicao-capas",
    "medicoes-pdf",
    "contratos",
    "dsl-uploads",
    "clientes",
    "logos"
  ];

  // Se já começa com um bucket conhecido, está ok
  if (supabaseBuckets.some(bucket => trimmedPath.startsWith(`${bucket}/`))) {
    return trimmedPath;
  }

  // Se começa com "uploads/", inferimos "contratos/" (regra histórica)
  if (trimmedPath.startsWith("uploads/")) {
    return `contratos/${trimmedPath}`;
  }

  // Mapeamento de inferência por contexto
  if (context) {
    const contextMap: Record<string, string> = {
      "diario_fotos": "diario-fotos",
      "diario_campo_fotos": "diario-fotos",
      "contratos": "contratos",
      "profiles": "avatars",
      "medicao_exports": "medicoes-pdf",
      "empresas": "medicao-capas",
      "clientes": "medicao-capas"
    };

    const inferredBucket = contextMap[context];
    if (inferredBucket) {
      // Se detectarmos um UUID (formato 8-4-4-4-12) ou um timestamp inicial, 
      // é um forte indício de que o bucket está faltando
      const isLikelyMissingBucket = /^[0-9a-f]{8}-|^[0-9]{10,13}_/.test(trimmedPath);
      
      if (isLikelyMissingBucket) {
        return `${inferredBucket}/${trimmedPath}`;
      }
    }
  }

  return trimmedPath;
}

/**
 * Resolve uma URL de arquivo de forma híbrida e robusta para garantir compatibilidade histórica.
 * 
 * REGRAS:
 * 1. Se path estiver vazio: retornar string vazia.
 * 2. Se path já for URL absoluta (http/https): retornar sem alteração.
 * 3. Se path começar com buckets conhecidos: retornar ${SUPABASE_BASE}/${path}
 * 4. Se path começar apenas com "uploads/": retornar ${SUPABASE_BASE}/contratos/${path}
 * 5. Se contiver ".r2.dev": retornar sem alteração.
 * 6. Caso contrário: usar R2 por padrão.
 */
export function resolveFileUrl(path: string | null | undefined, preserveThumbs = false, context?: string): string {
  if (!path || path.trim() === "") return "";
  
  let trimmedPath = normalizeLegacyStoragePath(path, context);

  // 1. Corrigir caminhos de thumbnails antigos (removendo /thumbs/300/, /thumbs/600/, /thumbs/900/)
  if (!preserveThumbs && trimmedPath.includes("/thumbs/")) {
    trimmedPath = trimmedPath.replace(/\/thumbs\/(300|600|900)\//, "/");
  }

  // 2. Se já for uma URL absoluta (R2, Supabase ou externa), retorna sem alteração
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  // 3. Buckets conhecidos do Supabase (arquivos antigos)
  const supabasePrefixes = [
    "diario-fotos/",
    "diario-campo-fotos/",
    "timeline-evidencias/",
    "avatars/",
    "medicao-capas/",
    "medicoes-pdf/",
    "contratos/",
    "dsl-uploads/",
    "clientes/",
    "logos/"
  ];

  // Verifica se começa com algum dos prefixos do Supabase
  if (supabasePrefixes.some(prefix => trimmedPath.startsWith(prefix))) {
    return `${SUPABASE_BASE}/${trimmedPath}`;
  }

  // 4. Regra especial para "uploads/" -> prepend "contratos/" (legado Supabase)
  if (trimmedPath.startsWith("uploads/")) {
    return `${SUPABASE_BASE}/contratos/${trimmedPath}`;
  }

  // 5. Se contiver .r2.dev (garante que URLs do R2 não sejam alteradas se passadas como path parcial)
  if (trimmedPath.includes(".r2.dev")) {
    return trimmedPath.startsWith("/") ? `https://${trimmedPath.slice(1)}` : `https://${trimmedPath}`;
  }

  // 6. Caso padrão: tratar como arquivo novo no R2
  const cleanPath = trimmedPath.startsWith("/") ? trimmedPath.slice(1) : trimmedPath;
  return `${R2_PUBLIC_BASE_URL}/${cleanPath}`;
}
