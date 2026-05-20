
import { resolveFileUrl } from "@/utils/fileUrlResolver";

/**
 * Gera uma lista de URLs possíveis para tentar carregar uma imagem,
 * priorizando thumbnails e caindo para a original ou reconstruções seguras.
 */
export function buildPossibleImageUrls(
  primarySrc: string | null | undefined,
  altUrls: (string | null | undefined)[] = []
): string[] {
  const urls = new Set<string>();
  const addUrl = (u: string | null | undefined, preserveThumbs = true) => {
    if (u && typeof u === 'string' && u.trim() !== "") {
      const resolved = resolveFileUrl(u.trim(), preserveThumbs);
      if (resolved) urls.add(resolved);
    }
  };

  // 1. Adicionar primarySrc (geralmente thumb_url se passado)
  addUrl(primarySrc, true);

  // 2. Adicionar alternativas passadas (url, medium_url, etc)
  altUrls.forEach(u => addUrl(u, true));

  // 3. Tentar reconstruções automáticas para cada URL já coletada
  const currentUrls = Array.from(urls);
  currentUrls.forEach(u => {
    // Se for uma thumbnail, tentar a original
    if (u.includes("/thumbs/") || u.includes("/600/") || u.includes("/medium/") || u.includes("/small/")) {
      const original = u
        .replace(/\/thumbs\/(300|600|900)\//, "/")
        .replace(/\/600\//, "/")
        .replace(/\/medium\//, "/")
        .replace(/\/small\//, "/");
      
      if (original !== u) urls.add(original);
    }
    
    // Fallback R2 -> Supabase (se aplicável)
    if (u.includes(".r2.dev")) {
      const SUPABASE_BASE = 'https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public';
      try {
        const urlObj = new URL(u);
        const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
        urls.add(`${SUPABASE_BASE}/${path}`);
      } catch (e) {
        // Silently skip malformed URLs
      }
    }
  });

  return Array.from(urls);
}
