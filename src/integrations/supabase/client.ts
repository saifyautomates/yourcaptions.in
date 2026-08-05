import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded fallback since OS environment has a typo.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mqotnlflwrgqpbhjkwyq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'mock-key';

// Fix for incorrect env var in OS
const url = SUPABASE_URL.replace('mqotnflwrgqppbhjkwyq', 'mqotnlflwrgqpbhjkwyq');

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

export const supabase = createClient<Database>(url, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

