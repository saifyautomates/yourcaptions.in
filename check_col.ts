import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

async function check() {
  const { data, error } = await admin.from('profiles').select('onboarding_dismissed_at').limit(1);
  console.log("profiles.onboarding_dismissed_at:", error);
}
check();
