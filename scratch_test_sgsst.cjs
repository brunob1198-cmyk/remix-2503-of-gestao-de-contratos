const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('.env', 'utf-8');
const env = envStr.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  const funcoesRes = await supabase.from('sgsst_funcoes').select('*').limit(1);
  console.log('sgsst_funcoes:', funcoesRes.error ? funcoesRes.error.message : 'OK', funcoesRes.data);

  const colabRes = await supabase.from('sgsst_colaborador_dados').select('*').limit(1);
  console.log('sgsst_colaborador_dados:', colabRes.error ? colabRes.error.message : 'OK', colabRes.data);
}

main();
