import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.rpc('admin_list_users');
  console.log("admin_list_users:", error);
}
check();
