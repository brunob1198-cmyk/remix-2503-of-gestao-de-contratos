import { migrateTableRecords } from "@/utils/storageMigration";

/**
 * Script utilitário para normalizar e MIGRAR arquivos de contratos e fotos antigos.
 * Agora ele não apenas troca a URL, mas também move o arquivo físico do Supabase para o R2.
 */
export async function normalizarUrlsContratos() {
  console.log("Iniciando migração física de arquivos (v4)...");
  
  try {
    // Para simplificar e garantir que o usuário veja progresso, 
    // podemos usar a mesma lógica da página de migração, 
    // mas focada nos itens de contrato e fotos de diário que são os mais críticos aqui.
    
    // 1. Migrar Contratos
    await migrateTableRecords("contratos", "id", ["arquivo_url"]);

    // 2. Migrar Fotos do Diário
    await migrateTableRecords("diario_fotos", "id", ["url", "thumb_url", "thumb_600_url"]);

    // 3. Migrar Fotos de Campo
    await migrateTableRecords("diario_campo_fotos", "id", ["url", "thumb_url", "thumb_600_url"]);

    return { success: true };
  } catch (err) {
    console.error("Erro crítico na migração via botão:", err);
    throw err;
  }
}
