import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";
const url = (process.env.SUPABASE_URL || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
console.log("URL:", url);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data, error } = await admin.from('plan_pricing').select('*').limit(1);
  console.log("error:", error);
}
check();
