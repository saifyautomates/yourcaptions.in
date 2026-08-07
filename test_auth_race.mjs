import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

supabase.auth.onAuthStateChange((event, session) => {
  console.log("EVENT FIRED:", event);
});

async function run() {
  await new Promise(r => setTimeout(r, 1000));
  console.log("Signing up...");
  const email = 'test' + Date.now() + '@gmail.com';
  const res1 = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  console.log("Signup:", res1.error?.message || "Success");
  
  if (!res1.error) {
     console.log("Signing in...");
     const res2 = await supabase.auth.signInWithPassword({
       email,
       password: 'password123'
     });
     console.log("Signin:", res2.error?.message || "Success");
  }
}
run();
