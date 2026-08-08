import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.rpc('admin_get_user_by_email', { user_email: 'test' });
console.log("admin_get_user_by_email:", { data, error });
