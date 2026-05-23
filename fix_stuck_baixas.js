import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env');
const envStr = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envStr.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const parts = line.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      return [key, val];
    })
);

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching logs with 'Erro na Baixa'...");
  const { data: logs, error } = await supabase
    .from("flash_integration_logs")
    .select("id, flash_transaction_id, erro, reconciliado")
    .like("erro", "%Erro na Baixa%");

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(`Found ${logs?.length || 0} logs with 'Erro na Baixa'.`);
  for (const log of logs || []) {
    console.log(`Log ID: ${log.id}, Reconciliado: ${log.reconciliado}`);
    if (log.reconciliado === true) {
      console.log(`Resetting reconciliado to false for log ${log.id}...`);
      const { error: updateErr } = await supabase
        .from("flash_integration_logs")
        .update({ reconciliado: false })
        .eq("id", log.id);
        
      if (updateErr) {
        console.error(`Failed to update log ${log.id}:`, updateErr);
      } else {
        console.log(`Successfully reset log ${log.id}`);
      }
    }
  }
}

main();
