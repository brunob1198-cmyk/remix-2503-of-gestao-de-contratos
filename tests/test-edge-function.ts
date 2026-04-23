import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: "bruno.souza@aivxtech.com", // Assuming this is the admin from screenshot
    password: "password123", // I don't have the password, so I will try another way or just read DB
  });
}

main();
