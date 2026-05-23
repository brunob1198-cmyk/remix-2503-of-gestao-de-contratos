async function main() {
  try {
    const fetch = globalThis.fetch;
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-send-transaction?action=get_logs");
    const { logs } = await resp.json();
    console.log(logs.slice(0,2).map(l => ({ id: l.id, tx_id: l.flash_transaction_id, err: l.erro })));
  } catch (e) {
    console.error(e);
  }
}
main();
