import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function run() {
  const { data, error } = await admin.rpc('get_tables', {});
  console.log("RPC get_tables:", error);
}
run();
