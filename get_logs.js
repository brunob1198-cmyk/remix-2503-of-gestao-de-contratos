async function main() {
  try {
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-send-transaction?action=get_logs");
    const data = await resp.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
