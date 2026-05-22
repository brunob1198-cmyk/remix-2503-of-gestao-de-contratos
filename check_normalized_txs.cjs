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

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking flash_normalizacao...");
  const { data: norms, error } = await supabase
    .from("flash_normalizacao")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching normalizacao:", error);
    return;
  }

  console.log(`Found ${norms.length} records in flash_normalizacao:`);
  for (const n of norms) {
    console.log("-----------------------------------------");
    console.log(`Transaction ID: ${n.flash_transaction_id}`);
    console.log(`Status: ${n.status}`);
    console.log(`Enviado At: ${n.enviado_at}`);
    console.log(`Motivo: ${n.motivo}`);
    console.log(`Payload Snapshot:`, JSON.stringify(n.conta_azul_payload, null, 2));
  }
}

main().catch(console.error);
