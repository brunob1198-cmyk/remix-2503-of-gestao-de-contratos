import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: projetos, error: pError } = await supabase.from('projetos').select('id, codigo').in('codigo', ['I014.25', 'I003.25']);
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
        .select('id, numero_medicao, status, data_medicao, quantidade')
        .in('site_id', siteIds)
        .eq('numero_medicao', '2026-03');
      if (mError) console.error(mError);
      
      console.log('Medições 2026-03 para esses projetos:', medições);
    }
  }
}
main();
