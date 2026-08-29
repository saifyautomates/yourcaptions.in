import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.from('plan_pricing').select('count', { count: 'exact', head: true });
  console.log("plan_pricing:", data, error);
}
check();
