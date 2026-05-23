async function main() {
  try {
    const fetch = globalThis.fetch;
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-send-transaction?action=get_logs");
    const { logs } = await resp.json();
    for (const log of logs.slice(0, 3)) {
      console.log(`Log ID: ${log.id}, error: ${log.erro}, status: ${log.status}, txId: ${log.flash_transaction_id}`);
    }
  } catch (e) {
    console.error(e);
  }
}
main();
