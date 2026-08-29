import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    console.error("Auth error:", error);
  } else {
    console.log("Users found:", data.users.length);
  }
}
check();
