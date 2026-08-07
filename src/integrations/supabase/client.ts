import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Use env vars, but fallback to the explicitly provided ones if they are missing or still have the typo
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
let SUPABASE_URL = ENV_URL === 'https://mqotnflwrgqppbhjkwyq.supabase.co' 
  ? 'https://mqotnlflwrgqpbhjkwyq.supabase.co' 
  : ENV_URL;
if (!SUPABASE_URL) {
  SUPABASE_URL = 'https://mqotnlflwrgqpbhjkwyq.supabase.co';
}

const ENV_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
let SUPABASE_PUBLISHABLE_KEY = ENV_KEY;
if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY === 'sb_publishable_1AFmVWLFFQVZ6Yk6fWOW3Q_5Dlk4YNh') {
  SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LkOndGRjB-Ymj_7DIxF-ug_FUPQzUFI';
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase environment variables. Please check your .env file.");
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
