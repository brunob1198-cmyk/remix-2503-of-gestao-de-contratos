import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://xqdhyukmeklfczwiipen.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZGh5dWttZWtsZmN6d2lpcGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDczNTksImV4cCI6MjA5MDAyMzM1OX0.DPbyonqvq2xg4Qvpz2qibikX29XLcLMGRCLcZF6TOjY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from("diario_producao")
    .select("diario_id, item_lpu_id, valor_total, item_lpu:itens_lpu(bdi)")
    .limit(1);

  if (error) {
    console.error("Error fetching diario_producao:", error.message);
  } else {
    console.log("Success diario_producao:", data);
  }
  
  const { data: bdiData, error: bdiError } = await supabase
    .from("item_lpu_bdi_mensal")
    .select("item_lpu_id, mes_referencia, bdi, itens_lpu!inner(projeto_id)")
    .limit(1);
    
  if (bdiError) {
    console.error("Error fetching item_lpu_bdi_mensal:", bdiError.message);
  } else {
    console.log("Success item_lpu_bdi_mensal:", bdiData);
  }
}

main();
