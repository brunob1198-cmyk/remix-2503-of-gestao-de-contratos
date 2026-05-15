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

// Use service role key if available for bypassing RLS
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  // Try fetching from flash_transactions_raw
  const { data: txns, error } = await supabase
    .from("flash_transactions_raw")
    .select("id, external_id, payload_json, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error.message);
    console.log("\nTrying with RPC or direct query...");
    return;
  }

  if (!txns || txns.length === 0) {
    console.log("No transactions found (RLS may be blocking). Trying flash_normalizacao...");
    
    // Try flash_normalizacao instead
    const { data: norms, error: nErr } = await supabase
      .from("flash_normalizacao")
      .select("flash_transaction_id, conta_azul_payload, status")
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (nErr) {
      console.error("Normalizacao error:", nErr.message);
    } else {
      console.log(`Found ${norms?.length || 0} normalizacao records`);
      if (norms?.length) {
        console.log("Sample conta_azul_payload:", JSON.stringify(norms[0].conta_azul_payload, null, 2));
      }
    }
    return;
  }

  console.log(`Found ${txns.length} raw transactions\n`);

  for (const tx of txns) {
    const p = tx.payload_json || {};
    console.log("=" .repeat(80));
    console.log("TX:", tx.external_id);
    console.log("Created:", tx.created_at);
    
    // Print ALL top-level keys
    console.log("\nTop-level keys:", Object.keys(p).join(", "));
    
    // Look for cost center under every possible path
    console.log("\n--- Cost Center Analysis ---");
    const ccPaths = {
      "costCenter": p.costCenter,
      "costCenter (type)": typeof p.costCenter,
      "cost_center": p.cost_center,
      "costCenterId": p.costCenterId,
      "cost_center_id": p.cost_center_id,
      "centro_custo": p.centro_custo,
      "employee?.costCenter": p.employee?.costCenter,
      "employee?.costCenterId": p.employee?.costCenterId,
    };
    for (const [path, val] of Object.entries(ccPaths)) {
      if (val !== undefined && val !== null) {
        console.log(`  ${path}:`, JSON.stringify(val));
      }
    }
    
    // Look for comments under every possible path
    console.log("\n--- Comments Analysis ---");
    const commentPaths = {
      "comments": p.comments,
      "comment": p.comment,
      "observacao": p.observacao,
      "observation": p.observation,
      "note": p.note,
      "notes": p.notes,
      "description": p.description,
      "justification": p.justification,
      "reason": p.reason,
      "memo": p.memo,
      "remark": p.remark,
      "remarks": p.remarks,
    };
    for (const [path, val] of Object.entries(commentPaths)) {
      if (val !== undefined && val !== null) {
        console.log(`  ${path}:`, JSON.stringify(val).substring(0, 200));
      }
    }
    
    // Look for category info
    console.log("\n--- Category Analysis ---");
    const catPaths = {
      "category": p.category,
      "category (type)": typeof p.category,
      "categoria": p.categoria,
      "type": p.type,
      "expenseType": p.expenseType,
      "expense_type": p.expense_type,
    };
    for (const [path, val] of Object.entries(catPaths)) {
      if (val !== undefined && val !== null) {
        console.log(`  ${path}:`, JSON.stringify(val).substring(0, 300));
      }
    }
    
    // Print the FULL payload for the first transaction
    if (tx === txns[0]) {
      console.log("\n--- FULL PAYLOAD (first tx) ---");
      console.log(JSON.stringify(p, null, 2));
    }
    
    console.log("");
  }
}

main().catch(console.error);
