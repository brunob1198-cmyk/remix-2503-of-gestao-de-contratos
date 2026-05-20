
import { resolveFileUrl } from "@/utils/fileUrlResolver";

/**
 * Gera uma lista de URLs possíveis para tentar carregar uma imagem,
 * implementando o fallback progressivo robusto solicitado.
 */
export function buildPossibleImageUrls(
  primarySrc: string | null | undefined,
  altUrls: (string | null | undefined)[] = [],
  context?: string
): string[] {
  const urls = new Set<string>();
  
  const addUrl = (u: string | null | undefined, preserveThumbs = true) => {
    if (u && typeof u === 'string' && u.trim() !== "") {
      const resolved = resolveFileUrl(u.trim(), preserveThumbs, context);
      if (resolved) urls.add(resolved);
    }
  };

  // 1. Prioridade: URLs passadas explicitamente (podem ser thumbs)
  if (primarySrc) addUrl(primarySrc, true);
  altUrls.forEach(u => addUrl(u, true));

  // 2. Fallback: Reconstruir versões originais removendo segmentos de thumbnail
  const currentUrls = Array.from(urls);
  currentUrls.forEach(u => {
    const thumbSegments = ["/thumbs/600/", "/thumbs/300/", "/thumbs/900/", "/thumbs/", "/medium/", "/small/"];
    let isThumb = false;
    let reconstructed = u;

    thumbSegments.forEach(seg => {
      if (reconstructed.includes(seg)) {
        reconstructed = reconstructed.replace(seg, "/");
        isThumb = true;
      }
    });

    if (isThumb && reconstructed !== u) {
      urls.add(reconstructed);
    }
  });

  // 3. Fallback: Se for R2 e falhar, tentar Supabase equivalente (se houver bucket mapeado)
  const r2Base = "r2.dev";
  const supabaseBase = "https://xqdhyukmeklfczwiipen.supabase.co/storage/v1/object/public";
  
  Array.from(urls).forEach(u => {
    if (u.includes(r2Base) && !u.includes("supabase.co")) {
      try {
        const urlObj = new URL(u);
        const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
        // Adicionamos via addUrl para que o resolveFileUrl aplique as correções de bucket/contexto
        addUrl(`${supabaseBase}/${path}`, true);
      } catch (e) {}
    }
  });

  const finalUrls = Array.from(urls);
  console.log(`[Fallback] URLs geradas para ${primarySrc}:`, finalUrls);
  return finalUrls;
}
