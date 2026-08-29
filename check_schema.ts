import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

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

async function checkTables() {
  console.log("Checking tables...");
  for (const table of tables) {
    const { data, error } = await admin.from(table).select('*').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        console.log(`- ${table}: DOES NOT EXIST (PGRST205)`);
      } else {
        console.log(`- ${table}: ERROR - ${error.message} (Code: ${error.code})`);
      }
    } else {
      console.log(`- ${table}: EXISTS`);
    }
  }

  console.log("\nChecking schema_migrations...");
  const { data: migrations, error: migError } = await admin.from('supabase_migrations.schema_migrations').select('*').limit(100);
  if (migError) {
    console.log(`- schema_migrations: ERROR - ${migError.message} (Code: ${migError.code})`);
  } else {
    console.log(`- schema_migrations: EXISTS. Found ${migrations.length} migrations.`);
  }
}

checkTables();
