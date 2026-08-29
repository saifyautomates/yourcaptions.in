import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL || "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.log("No SUPABASE_SERVICE_ROLE_KEY found in env");
  process.exit(1);
}
const admin = createClient(url, key);

async function inspect() {
  const { data, error } = await admin.rpc('run_sql_query', { query: "SELECT proname, pg_get_functiondef(oid) as def FROM pg_proc WHERE proname IN ('has_role', 'add_credits');" });
  if (error) {
    console.error("RPC failed, trying raw query via REST or edge function...", error);
  } else {
    console.log("Functions:", data);
  }
}
inspect();
