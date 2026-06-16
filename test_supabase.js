import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from("diario_producao")
    .select("diario_id, item_lpu_id, valor_total, item_lpu:itens_lpu(bdi, item_lpu_bdi_mensal(mes_referencia, bdi))")
    .limit(1);

  if (error) {
    console.error("Error fetching:", error.message);
  } else {
    console.log("Success:", data);
  }
}

main();
