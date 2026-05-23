async function main() {
  console.log("Fetching logs from diagnostic endpoint...");
  try {
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-send-transaction?action=get_logs");
    if (!resp.ok) {
      console.error(`HTTP Error: ${resp.status}`);
      return;
    }
    const data = await resp.json();
    if (data.error) {
      console.error("Endpoint returned error:", data.error);
      return;
    }
    const logs = data.logs || [];
    console.log(`Found ${logs.length} logs:`);
    for (const log of logs) {
      if (log.status !== "ENVIADO" || log.erro) {
        console.log("=========================================");
        console.log(`ID: ${log.id}`);
        console.log(`Flash Transaction ID: ${log.flash_transaction_id}`);
        console.log(`Conta Azul ID: ${log.conta_azul_transaction_id}`);
        console.log(`Status: ${log.status}`);
        console.log(`Erro: ${log.erro}`);
        console.log(`Created At: ${log.created_at}`);
        if (log.response && log.response.last_poll_data) {
           console.log("Polling Status:", log.response.last_poll_data.status);
        }
      }
    }
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

main();
