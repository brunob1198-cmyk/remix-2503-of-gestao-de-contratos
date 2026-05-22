const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env');
const envStr = fs.readFileSync(envPath, 'utf-8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY missing from env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking integration logs from workspace...");
  const { data: logs, error } = await supabase
    .from("flash_integration_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(`Found ${logs.length} logs:`);
  for (const log of logs) {
    console.log("=========================================");
    console.log(`ID: ${log.id}`);
    console.log(`Flash Transaction ID: ${log.flash_transaction_id}`);
    console.log(`Conta Azul ID: ${log.conta_azul_transaction_id}`);
    console.log(`Status: ${log.status}`);
    console.log(`HTTP Status: ${log.http_status}`);
    console.log(`Created At: ${log.created_at}`);
    console.log(`Reconciliado: ${log.reconciliado}`);
    console.log(`Erro: ${log.erro}`);
    console.log(`Response:`, JSON.stringify(log.response, null, 2));
  }
}

main().catch(console.error);
