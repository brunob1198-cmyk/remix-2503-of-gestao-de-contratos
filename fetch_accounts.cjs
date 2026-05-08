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

async function main() {
  const { data, error } = await supabase.from("contaazul_financial_accounts").select("*");
  if (error) console.error("Error:", error);
  else console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
