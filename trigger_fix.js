async function main() {
  try {
    console.log("Triggering fix_stuck action...");
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-send-transaction?action=fix_stuck");
    const data = await resp.json();
    console.log(`Status: ${resp.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
  } catch (e) {
    console.error(e);
  }
}
main();
