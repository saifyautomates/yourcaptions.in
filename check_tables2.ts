import { createClient } from "@supabase/supabase-js";
const url = "https://mqotnlflwrgqpbhjkwyq.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key);

const tables = [
  'usage_events',
  'jobs',
  'usage_meters',
  'user_roles',
  'user_assets',
  'teams',
  'team_members',
  'team_invitations',
  'error_logs',
  'usage_alerts',
  'security_findings',
  'hero_media',
  'security_audit_log',
  'platform_settings',
  'activity_log',
  'hero_transcripts',
  'hero_transcript_translations',
  'templates',
  'library_items',
  'feedback_submissions',
  'simplified_users',
  'brand_kits',
  'admin_trusted_devices'
];

async function check() {
  for (const t of tables) {
    const { data, error } = await admin.from(t).select('count', { count: 'exact', head: true });
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
