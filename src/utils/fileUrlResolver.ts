
const R2_PUBLIC_BASE_URL = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";
const SUPABASE_PROJECT_ID = "xqdhyukmeklfczwiipen";
const SUPABASE_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public`;

/**
 * Resolve uma URL de arquivo de forma híbrida:
 * 1. Se for URL absoluta, retorna como está.
 * 2. Se o caminho contiver buckets conhecidos do Supabase, retorna a URL do Supabase preservando o path completo.
 * 3. Caso contrário, trata como arquivo novo no R2.
 */
export function resolveFileUrl(path: string | null | undefined): string {
  if (!path || path.trim() === "") return "";
  
  const trimmedPath = path.trim();

  // 1. Se já for uma URL absoluta (R2, Supabase ou externa), retorna sem alteração
  if (trimmedPath.startsWith("http")) {
    return trimmedPath;
  }

  // 2. Buckets conhecidos do Supabase (arquivos antigos)
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

  // Verifica se o path contém qualquer um dos buckets conhecidos
  const isSupabasePath = supabaseBuckets.some(bucket => trimmedPath.includes(bucket));

  if (isSupabasePath) {
    // Se o path contém o bucket mas tem lixo antes (ex: "outra-coisa/diario-fotos/..."), 
    // ou se já começa com o bucket, preservamos o path completo a partir do primeiro match do bucket
    // ou simplesmente retornamos a URL do Supabase com o path completo original se ele já for relativo correto.
    
    // Conforme instrução: "RETORNAR exatamente https://...supabase.co/.../${path} SEM modificar nada"
    // Remove apenas a barra inicial se existir para garantir concatenação correta
    const cleanPath = trimmedPath.startsWith("/") ? trimmedPath.slice(1) : trimmedPath;
    return `${SUPABASE_BASE_URL}/${cleanPath}`;
  }

  // 3. Caso padrão: tratar como arquivo novo no R2
  const cleanPath = trimmedPath.startsWith("/") ? trimmedPath.slice(1) : trimmedPath;
  return `${R2_PUBLIC_BASE_URL}/${cleanPath}`;
}
