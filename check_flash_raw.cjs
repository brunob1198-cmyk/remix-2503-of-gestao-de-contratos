const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
const envStr = fs.readFileSync(envPath, 'utf-8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: logs, error } = await supabase
    .from("flash_transactions_raw")
    .select("created_at, payload_json")
    .limit(10);

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  console.log(`Found ${logs.length} transactions total.`);
  if (logs.length > 0) {
    console.log("Example payload date:", logs[0].payload_json?.date || logs[0].payload_json?.transaction_date || logs[0].payload_json?.created_at);
  }
}

main().catch(console.error);
