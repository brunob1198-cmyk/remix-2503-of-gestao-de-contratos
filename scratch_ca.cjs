const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CONTAAZUL_API = "https://api-v2.contaazul.com";

async function testProtocol(accessToken, protocol, type) {
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

async function main() {
  const empresaId = "b1a2f3f6-863d-42a5-80b9-d9cd7faa4a00";
  const { data: tokenData } = await supabase.from("contaazul_tokens").select("*").eq("empresa_id", empresaId).single();

  if (tokenData) {
    console.log("Testing Protocol 13e3a0c2-4a45-11f1-b817-b722679cb245");
    await testProtocol(tokenData.access_token, "13e3a0c2-4a45-11f1-b817-b722679cb245", "despesa");
    
    console.log("Testing Protocol 94d2db1c-4a45-11f1-a0d2-73033b4e3aff");
    await testProtocol(tokenData.access_token, "94d2db1c-4a45-11f1-a0d2-73033b4e3aff", "despesa");
  }
}

main().catch(console.error);
