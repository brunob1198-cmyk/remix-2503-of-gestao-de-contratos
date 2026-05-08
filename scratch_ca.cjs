const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const envVars = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split("\n")
    .filter(l => l.trim() && !l.startsWith("#"))
    .map(l => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^['"]|['"]$/g, '')];
    })
);

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
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
    const urls = [
      "https://api-v2.contaazul.com/v1/conta-financeira",
      "https://api-v2.contaazul.com/v1/contas-financeiras",
      "https://api-v2.contaazul.com/v1/bank-accounts"
    ];

    for (const url of urls) {
      console.log(`Buscando em: ${url}`);
      try {
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
            "Accept": "application/json"
          }
        });
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Resposta: ${text.substring(0, 500)}`);
      } catch (e) {
        console.log("Erro:", e.message);
      }
    }
  }
}

main().catch(console.error);
