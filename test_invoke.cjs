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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
  if (!profile) return console.log("No profile found");

  const testId = "8c2ebdea-b22c-4d6f-987a-2de0b8bf8275";
  console.log("Invoking function with user", profile.id, "and tx", testId);

  const resp = await fetch(`${supabaseUrl}/functions/v1/contaazul-send-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${profile.id}`
    },
    body: JSON.stringify({ flash_transaction_ids: [testId] })
  });

  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Response:", text);
}

main().catch(console.error);
