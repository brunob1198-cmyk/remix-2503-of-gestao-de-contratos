
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scan() {
  const { data, error } = await supabase
    .from('flash_transactions_raw')
    .select('payload_json')
    .limit(100);

  if (error) {
    console.error(error);
    return;
  }

  const pathsFound = new Set();

  function traverse(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      if (key.toLowerCase().includes('cost') || key.toLowerCase().includes('centro') || key.toLowerCase().includes('depart')) {
        pathsFound.add(newPath + ' -> ' + JSON.stringify(obj[key]));
      }
      traverse(obj[key], newPath);
    }
  }

  data.forEach(row => traverse(row.payload_json));
  
  console.log("Paths found involving 'cost', 'centro', or 'depart':");
  pathsFound.forEach(p => console.log(p));
}

scan();
