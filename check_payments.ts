import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await admin.from('payments').select('id').limit(1);
  console.log("payments error:", error);
}
check();
