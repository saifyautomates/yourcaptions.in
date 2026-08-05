import { supabase } from "@/integrations/supabase/client";

export async function adminFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}${path}`;
  
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (!headers.has('Content-Type') && options.method === 'PATCH') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
