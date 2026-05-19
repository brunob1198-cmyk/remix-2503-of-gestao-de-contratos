
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";
const SUPABASE_PROJECT_ID = "xqdhyukmeklfczwiipen";
const SUPABASE_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public`;

/**
 * Resolve uma URL de arquivo de forma híbrida:
 * 1. Se for URL absoluta do R2, mantém.
 * 2. Se for URL absoluta do Supabase, mantém.
 * 3. Se for um caminho que pertence a buckets conhecidos do Supabase, gera a URL do Supabase.
 * 4. Caso contrário, assume que é um arquivo novo no R2.
 */
export function resolveFileUrl(path: string | null | undefined): string {
  if (!path || path.trim() === "") return "";
  
  const trimmedPath = path.trim();

  // 1. Já é uma URL absoluta do R2
  if (trimmedPath.includes(R2_PUBLIC_BASE_URL)) {
    return trimmedPath;
  }

  // 2. Já é uma URL absoluta do Supabase
  if (trimmedPath.includes("supabase.co/storage/v1/object/public/")) {
    return trimmedPath;
  }

  // Se começar com http mas não for R2 nem Supabase, retorna como está (ex: links externos)
  if (trimmedPath.startsWith("http")) {
    return trimmedPath;
  }

  // 3. Verifica se é um caminho relativo que pertence a buckets do Supabase
  // Estes são os prefixos que indicam arquivos antigos que ainda estão no Supabase
  const supabaseBuckets = [
    "diario-fotos/",
    "contratos/",
    "medicoes-pdf/",
    "timeline-evidencias/",
    "avatars/",
    "medicao-capas/",
    "dsl-uploads/",
    "uploads/",
    "clientes/",
    "logos/"
  ];

  const isSupabasePath = supabaseBuckets.some(bucket => trimmedPath.startsWith(bucket));

  if (isSupabasePath) {
    // Retorna a URL pública do Supabase
    return `${SUPABASE_BASE_URL}/${trimmedPath}`;
  }

  // 4. Caso padrão: tratar como arquivo novo no R2
  // Remove / inicial se houver para não duplicar na URL
  const cleanPath = trimmedPath.startsWith("/") ? trimmedPath.slice(1) : trimmedPath;
  return `${R2_PUBLIC_BASE_URL}/${cleanPath}`;
}
