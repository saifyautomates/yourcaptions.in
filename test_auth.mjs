import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, anonKey);
const admin = createClient(supabaseUrl, serviceKey);

const testEmail = `test_${Date.now()}@gmail.com`;
const testPassword = 'TestPassword123!';

console.log("1. Creating user via Admin API (to bypass IP rate limits for tests)...");
const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
  user_metadata: { full_name: 'End to End Tester' }
});

if (signUpError) {
  console.error("❌ Signup failed:", signUpError.message);
  process.exit(1);
}

const userId = signUpData.user?.id;
console.log("✅ Signup success! User ID:", userId);

console.log("\n2. Signing in with email and password (simulating frontend login)...");
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword,
});

if (signInError) {
  console.error("❌ Sign in failed:", signInError.message);
  process.exit(1);
}

console.log("✅ Sign in success! Session established.");

console.log("\n3. Verifying profile via Authenticated Client (simulating dashboard load)...");
const { data: profile, error: profErr } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (profErr) {
  console.error("❌ Profile query failed:", profErr.message);
} else {
  console.log("✅ Profile found (RLS passed). Full Name:", profile.full_name);
}

console.log("\n4. Cleaning up test user...");
const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
if (deleteError) {
  console.error("❌ User cleanup failed:", deleteError.message);
} else {
  console.log("✅ Test user deleted.");
}

console.log("\n🎉 End-to-end auth test complete!");
