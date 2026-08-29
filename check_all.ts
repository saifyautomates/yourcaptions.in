import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

const tables = [
  'credit_rates',
  'plan_limits',
  'plan_pricing',
  'feature_flags',
  'system_settings',
  'admin_audit_log',
  'topup_pricing',
  'payments',
  'subscriptions',
  'credit_wallets',
  'profiles'
];

async function check() {
  for (const t of tables) {
    const { data, error } = await admin.from(t).select('*').limit(1);
    if (error && error.code === 'PGRST205') {
       console.log(t, "NOT APPLIED");
    } else if (error) {
       console.log(t, "ERROR", error.code, error.message);
    } else {
       console.log(t, "APPLIED");
    }
  }
}
check();
