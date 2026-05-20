
const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

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
export function resolveFileUrl(path: string | null | undefined, preserveThumbs = false): string {
  if (!path || path.trim() === "") return "";
  
  let trimmedPath = path.trim();

  // 1. Corrigir caminhos de thumbnails antigos (removendo /thumbs/300/, /thumbs/600/, /thumbs/900/)
  // Isso garante que se uma thumbnail antiga for solicitada, redirecionamos para o arquivo original
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
