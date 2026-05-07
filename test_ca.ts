
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONTAAZUL_API = "https://api-v2.contaazul.com";

async function testProtocol(accessToken: string, protocol: string, type: string) {
  const importPath = type === "receita" ? "contas-a-receber/importacao" : "contas-a-pagar/importacao";
  const url = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${importPath}/${protocol}`;
  console.log(`Testing URL: ${url}`);
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  });
  console.log(`Status: ${resp.status}`);
  if (resp.ok) {
    console.log(`Data:`, await resp.json());
  } else {
    console.log(`Error:`, await resp.text());
  }
}

async function testSearch(accessToken: string, type: string, date: string, value: number) {
  const path = type === "receita" ? "contas-a-receber" : "contas-a-pagar";
  const url = `${CONTAAZUL_API}/v1/financeiro/eventos-financeiros/${path}/buscar?data_vencimento_de=${date}&data_vencimento_ate=${date}&valor=${value}`;
  console.log(`Searching URL: ${url}`);
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  });
  console.log(`Status: ${resp.status}`);
  if (resp.ok) {
    console.log(`Results:`, await resp.json());
  } else {
    console.log(`Error:`, await resp.text());
  }
}

const empresaId = "b1a2f3f6-863d-42a5-80b9-d9cd7faa4a00";
const { data: tokenData } = await supabase.from("contaazul_tokens").select("*").eq("empresa_id", empresaId).single();

if (tokenData) {
  console.log("Testing Protocol 13e3a0c2-4a45-11f1-b817-b722679cb245");
  await testProtocol(tokenData.access_token, "13e3a0c2-4a45-11f1-b817-b722679cb245", "despesa");
}
