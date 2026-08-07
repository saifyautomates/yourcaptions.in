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

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  console.log("Login result:", { data: data?.user?.id, error });
  
  if (!error) {
     const { data: sData, error: sErr } = await supabase.auth.getSession();
     console.log("Session:", { hasSession: !!sData?.session, error: sErr });
  }
}
run();
