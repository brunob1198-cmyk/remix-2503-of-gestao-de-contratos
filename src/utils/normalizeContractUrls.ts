import { supabase } from "@/integrations/supabase/client";
import { resolveFileUrl } from "@/utils/fileUrlResolver";

/**
 * Script utilitário para normalizar URLs de contratos e fotos antigos.
 * Força a limpeza de prefixos antigos e converte para URLs absolutas do R2.
 */
export async function normalizarUrlsContratos() {
  console.log("Iniciando normalização PROFUNDA de URLs (v2)...");
  
  try {
    // 1. Normalizar Contratos
    const { data: contratos, error: errContratos } = await supabase
      .from("contratos")
      .select("id, arquivo_url")
      .not("arquivo_url", "is", null)
      .not("arquivo_url", "eq", "");

    if (errContratos) throw errContratos;
    
    let contratosAtu = 0;
    for (const c of (contratos || [])) {
      const novaUrl = resolveFileUrl(c.arquivo_url);
      
      // Atualizamos SE a URL mudou OU se ainda for um caminho relativo (não começa com http)
      if (novaUrl !== c.arquivo_url || !c.arquivo_url.startsWith("http")) {
        const { error: updErr } = await supabase
          .from("contratos")
          .update({ arquivo_url: novaUrl })
          .eq("id", c.id);
        
        if (!updErr) {
          contratosAtu++;
        }
      }
    }

    // 2. Normalizar Fotos do Diário
    const { data: fotos, error: errFotos } = await supabase
      .from("diario_fotos")
      .select("id, url, thumb_url, thumb_600_url")
      .or("url.ilike.%supabase.co%,url.not.ilike.http%,thumb_url.ilike.%supabase.co%,thumb_600_url.ilike.%supabase.co%");

    if (errFotos) throw errFotos;

    let fotosAtu = 0;
    for (const f of (fotos || [])) {
      const updates: any = {};
      const novaUrl = resolveFileUrl(f.url);
      const novaThumb = f.thumb_url ? resolveFileUrl(f.thumb_url) : null;
      const novaMedium = f.thumb_600_url ? resolveFileUrl(f.thumb_600_url) : null;

      if (novaUrl !== f.url) updates.url = novaUrl;
      if (novaThumb && novaThumb !== f.thumb_url) updates.thumb_url = novaThumb;
      if (novaMedium && novaMedium !== f.thumb_600_url) updates.thumb_600_url = novaMedium;

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase
          .from("diario_fotos")
          .update(updates)
          .eq("id", f.id);
        if (!updErr) fotosAtu++;
      }
    }

    // 3. Normalizar Fotos de Campo
    const { data: fotosCampo, error: errCampo } = await supabase
      .from("diario_campo_fotos")
      .select("id, url, thumb_url, thumb_600_url")
      .or("url.ilike.%supabase.co%,url.not.ilike.http%,thumb_url.ilike.%supabase.co%,thumb_600_url.ilike.%supabase.co%");

    if (!errCampo) {
      for (const f of (fotosCampo || [])) {
        const updates: any = {};
        const novaUrl = resolveFileUrl(f.url);
        const novaThumb = f.thumb_url ? resolveFileUrl(f.thumb_url) : null;
        const novaMedium = f.thumb_600_url ? resolveFileUrl(f.thumb_600_url) : null;

        if (novaUrl !== f.url) updates.url = novaUrl;
        if (novaThumb && novaThumb !== f.thumb_url) updates.thumb_url = novaThumb;
        if (novaMedium && novaMedium !== f.thumb_600_url) updates.thumb_600_url = novaMedium;

        if (Object.keys(updates).length > 0) {
          await supabase.from("diario_campo_fotos").update(updates).eq("id", f.id);
        }
      }
    }

    console.log(`Normalização finalizada: ${contratosAtu} contratos e ${fotosAtu} fotos.`);
    return { contratosAtu, fotosAtu };
  } catch (err) {
    console.error("Erro crítico na normalização:", err);
    throw err;
  }
}
