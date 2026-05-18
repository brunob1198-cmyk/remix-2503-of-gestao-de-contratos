import { uploadImage, verifyImageUrl, deleteImage } from "./uploadImage";
import { supabase } from "@/integrations/supabase/client";

export async function runUploadSmokeTest() {
  const results = {
    upload: false,
    verification: false,
    dbSave: false,
    dbRead: false,
    cleanup: false,
    error: null as string | null,
    url: null as string | null,
  };

  try {
    // 1. Prepare dummy file
    const dummyContent = "Smoke test " + new Date().toISOString();
    const file = new File([dummyContent], "smoke-test.txt", { type: "text/plain" });

    // 2. Upload
    console.log("SMOKE TEST: Starting upload...");
    const url = await uploadImage(file);
    results.url = url;
    results.upload = !!url;

    // 3. Verify URL accessibility
    console.log("SMOKE TEST: Verifying URL accessibility...");
    const isAccessible = await verifyImageUrl(url);
    results.verification = isAccessible;

    if (!isAccessible) throw new Error("URL is not accessible after upload");

    // 4. Test DB Save (using a generic logging table or similar if available, otherwise just use a known table and delete)
    // We'll use 'diarios_campo' and 'diario_campo_fotos' for the test if we can find/create a dummy record
    // For now, let's just verify the URL format is correct for R2
    if (!url.includes("obras-r2.bruno1198.workers.dev") && !url.includes("r2.dev") && !url.includes("workers.dev")) {
        console.warn("SMOKE TEST: URL does not seem to be from the expected R2 domain", url);
    }
    
    // 5. Cleanup
    if (url) {
      console.log("SMOKE TEST: Cleaning up...");
      const deleted = await deleteImage(url);
      results.cleanup = deleted;
    }

    return results;
  } catch (err: any) {
    console.error("SMOKE TEST FAILED:", err);
    results.error = err.message;
    return results;
  }
}
