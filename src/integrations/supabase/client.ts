import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/supabase`;
  }
  return import.meta.env.VITE_SUPABASE_URL;
};

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
