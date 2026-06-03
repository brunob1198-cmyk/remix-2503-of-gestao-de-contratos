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
    .from("flash_integration_logs")
    .select("id, evento, created_at, status")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(`Recent logs:`);
  console.table(logs);
}

main().catch(console.error);
