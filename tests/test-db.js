const fs = require('fs');
const envStr = fs.readFileSync('.env', 'utf-8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('faturamentos_conta_azul').select('*').limit(1);
  console.log('Faturamentos Conta Azul Table check:', error || 'OK', data);
  
  const { data: tokens, error: errTokens } = await supabase.from('contaazul_tokens').select('*').limit(1);
  console.log('Tokens:', errTokens || 'OK', tokens);
}
main();
