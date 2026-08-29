import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.from('profiles').select('id, credits_seconds, plan, created_at').limit(10);
  console.log("profiles:", data, error);
}
check();
