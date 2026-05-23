async function main() {
  try {
    console.log("Triggering reconciler job...");
    const resp = await fetch("https://xqdhyukmeklfczwiipen.supabase.co/functions/v1/contaazul-reconcile");
    const text = await resp.text();
    console.log(`Status: ${resp.status}`);
    console.log(`Response: ${text}`);
  } catch (e) {
    console.error(e);
  }
}
main();
