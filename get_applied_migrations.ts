import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.from('supabase_migrations.schema_migrations').select('version').order('version', { ascending: true });
  if (error) {
    console.log("ERROR fetching migrations", error);
  } else {
    console.log("APPLIED MIGRATIONS:");
    data.forEach(m => console.log(m.version));
  }
}
check();
