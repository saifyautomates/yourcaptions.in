import { createClient } from "@supabase/supabase-js";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: q, error: err } = await admin.rpc('get_tables', {});
  console.log(q, err);
}
check();
