import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";
const url = (process.env.SUPABASE_URL || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { error } = await admin.from('plan_limits').select('*').limit(1);
  console.log("plan_limits error:", error);
}
check();
