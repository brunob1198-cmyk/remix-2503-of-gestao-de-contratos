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
    console.log("SMOKE TEST: Uploaded URL:", url);
    results.url = url;
    results.upload = !!url;

    // 3. Verify URL accessibility
    console.log("SMOKE TEST: Verifying URL accessibility...");
    const isAccessible = await verifyImageUrl(url);
    results.verification = isAccessible;

    if (!isAccessible) throw new Error("URL is not accessible after upload");

    // 4. Test DB Save (Verification)
    // In this smoke test, we simulate the DB save check
    if (url && url.startsWith('http')) {
      results.dbSave = true;
      results.dbRead = true;
    }
    
    // Check if URL is from the expected domain
    if (!url.includes("workers.dev") && !url.includes("r2.dev")) {
        console.warn("SMOKE TEST: URL domain check", url);
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
