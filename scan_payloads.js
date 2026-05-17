import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scan() {
  const { data, error } = await supabase
    .from('flash_transactions_raw')
    .select('id, payload_json')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error(error);
    return;
  }

  const pathsFound = new Set();

  function traverse(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('cost') || lowerKey.includes('centro') || lowerKey.includes('depart') || lowerKey.includes('proj') || lowerKey.includes('tag')) {
        const val = obj[key];
        const valStr = typeof val === 'object' ? JSON.stringify(val).substring(0, 50) : String(val);
        pathsFound.add(`${newPath} -> ${valStr}`);
      }
      traverse(obj[key], newPath);
    }
  }

  data.forEach(row => {
    traverse(row.payload_json);
  });
  
  console.log("Paths found:");
  Array.from(pathsFound).sort().forEach(p => console.log(p));
}

scan();
