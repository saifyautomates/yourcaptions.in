import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  else {
    data.users.forEach(u => {
      console.log(u.email, "Confirmed:", !!u.email_confirmed_at, "Last SignIn:", u.last_sign_in_at);
    });
  }
}
run();
