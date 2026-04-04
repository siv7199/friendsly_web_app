import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAllLiveStatus() {
  console.log("Resetting all creator live statuses to offline...");
  const { data, error } = await supabase
    .from("creator_profiles")
    .update({ is_live: false })
    .match({ is_live: true });

  if (error) {
    console.error("Error resetting status:", error);
  } else {
    console.log("Successfully reset statuses.");
  }
}

resetAllLiveStatus();
