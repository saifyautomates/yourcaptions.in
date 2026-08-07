import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: { persistSession: false }
  }
);

supabase.auth.onAuthStateChange((event, session) => {
  console.log("EVENT FIRED:", event);
});

async function run() {
  await new Promise(r => setTimeout(r, 1000));
  console.log("Signing in...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  console.log("Sign in returned. Error:", error?.message);
}
run();
