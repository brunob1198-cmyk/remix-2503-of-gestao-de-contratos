import { supabase } from "@/integrations/supabase/client";

/**
 * Script utilitário para normalizar URLs de contratos antigos
 * que ainda estão com o caminho relativo (uploads/...)
 * para URLs absolutas do Cloudflare R2.
 */
export async function normalizarUrlsContratos() {
  console.log("Iniciando normalização de URLs de contratos...");
  const R2_BASE = "https://pub-8e0d5fd80efd4a7499610aa072d8f5f4.r2.dev";

  try {
    const { data: contratos, error } = await supabase
      .from("contratos")
      .select("id, arquivo_url")
      .not("arquivo_url", "is", null)
      .not("arquivo_url", "eq", "");

    if (error) throw error;
    if (!contratos || contratos.length === 0) {
      console.log("Nenhum contrato com arquivo_url encontrado.");
      return;
    }

    let atualizados = 0;
    for (const c of contratos) {
      if (!c.arquivo_url.startsWith("http")) {
        const novaUrl = `${R2_BASE}/${c.arquivo_url.startsWith('/') ? c.arquivo_url.slice(1) : c.arquivo_url}`;
        
        const { error: updateError } = await supabase
          .from("contratos")
          .update({ arquivo_url: novaUrl })
          .eq("id", c.id);

        if (updateError) {
          console.error(`Erro ao atualizar contrato ${c.id}:`, updateError);
        } else {
          atualizados++;
        }
      }
    }

    console.log(`Normalização concluída. ${atualizados} contratos atualizados.`);
    return atualizados;
  } catch (err) {
    console.error("Erro na normalização:", err);
    throw err;
  }
}
