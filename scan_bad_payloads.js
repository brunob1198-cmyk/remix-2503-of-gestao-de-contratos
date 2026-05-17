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
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }

  const results = [];

  data.forEach(row => {
    const p = row.payload_json;
    const hasCC = !!(p.costCenter || p.cost_center || (p.employee && (p.employee.costCenter || p.employee.cost_center)));
    if (!hasCC) {
      // Analyze this specific payload for potential candidates
      results.push({
        id: row.id,
        keys: Object.keys(p),
        employee: p.employee,
        transaction: p.transaction ? Object.keys(p.transaction) : null,
        referenceId: p.referenceId
      });
    }
  });
  
  console.log(`Found ${results.length} payloads without obvious Cost Center out of 500.`);
  if (results.length > 0) {
    console.log("Sample of a 'bad' payload structure:");
    console.log(JSON.stringify(results[0], null, 2));
  }
}

scan();
