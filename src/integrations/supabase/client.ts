import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
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

// Configure functions client to route through local backend emulation in browser
if (typeof window !== 'undefined') {
  try {
    (supabase as any).functionsUrl = new URL(`${window.location.origin}/api/supabase/functions/v1`);
  } catch (e) {
    console.warn("Could not set custom functionsUrl", e);
  }
}
