import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

const tables = [
  'payments',
  'subscriptions',
  'credit_wallets',
  'profiles'
];

async function check() {
  for (const t of tables) {
    const { data, error } = await admin.from(t).select('*').limit(1);
    console.log(t, "error:", error?.code || 'OK');
  }
}
check();
