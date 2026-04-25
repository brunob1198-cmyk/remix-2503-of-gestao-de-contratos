const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].replace(/['"]/g, '').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: projetos, error: pError } = await supabase.from('projetos').select('id, codigo').in('codigo', ['I014.25', 'I003.25', 'T011.25', '0003.26']);
  if (pError) console.error(pError);
  console.log('Projetos:', projetos);

  if (projetos && projetos.length > 0) {
    const projetoIds = projetos.map(p => p.id);
    const { data: sites, error: sError } = await supabase.from('sites').select('id, projeto_id').in('projeto_id', projetoIds);
    if (sError) console.error(sError);
    
    if (sites && sites.length > 0) {
      const siteIds = sites.map(s => s.id);
      const { data: medições, error: mError } = await supabase
        .from('lancamentos_medicao')
        .select('id, numero_medicao, status, data_medicao, quantidade, quantidade_pendente, quantidade_aprovada, quantidade_rejeitada')
        .in('site_id', siteIds)
        .eq('numero_medicao', '2026-03');
      if (mError) console.error(mError);
      
      console.log('Medições 2026-03 para esses projetos:', medições);
    }
  }
}
main();
