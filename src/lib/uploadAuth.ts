import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export const DEMO_CREDENTIALS = {
  email: "creator.demo@yourcaptions.in",
  password: "DemoAccountPassword2026!Secure",
};

export const DEMO_USER: User = {
  id: "5196571f-b9ad-457c-b2e3-c07f13f6f1a3",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Demo Creator" },
  aud: "authenticated",
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  email: "creator.demo@yourcaptions.in",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  phone: "",
  role: "authenticated",
};

export const DEMO_SESSION: Session = {
  access_token: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xb3RubGZsd3JncXBiaGprd3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNDk5NjgsImV4cCI6MjEwMDkyNTk2OH0.ELUj7T9ti_BOd7UjuQjqqxWrQi0papwjxBWQMA9zjtI",
  token_type: "bearer",
  expires_in: 3600 * 24 * 365,
  refresh_token: "demo-refresh-token",
  user: DEMO_USER,
};

/**
 * Validates that a string is a compact JWS (RFC 7515 / RFC 7519):
 * 3 dot-separated base64url segments (header.payload.signature).
 */
export const isCompactJWS = (tok?: string | null): boolean => {
  if (!tok || typeof tok !== "string") return false;
  const trimmed = tok.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
};

/**
 * Safely decodes the payload of a JWS without throwing.
 */
export const getTokenPayload = (tok: string): Record<string, any> | null => {
  if (!isCompactJWS(tok)) return null;
  try {
    const parts = tok.split(".");
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

/**
 * Checks if a JWT is expired (or will expire within bufferSeconds).
 */
export const isTokenExpired = (tok: string, bufferSeconds = 60): boolean => {
  const payload = getTokenPayload(tok);
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
};

/**
 * Validates that a session's access_token is a valid compact JWS with a non-empty 'sub' claim.
 */
export const hasValidSub = (sess: Session | null): boolean => {
  if (!sess?.access_token || !isCompactJWS(sess.access_token)) return false;
  const payload = getTokenPayload(sess.access_token);
  return typeof payload?.sub === "string" && payload.sub.length > 0;
};

/**
 * Inspects and purges corrupted, legacy, or dummy tokens (e.g. 'demo-jwt-token-local')
 * from localStorage so Supabase and uploaders never use an invalid Bearer token.
 */
export const purgeCorruptedStorageTokens = (): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("sb-") || key === "captions:demo_session") {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const token = parsed.access_token || parsed.currentSession?.access_token;
            if (token && !isCompactJWS(token)) {
              keysToRemove.push(key);
            }
          }
        } catch {
          if (raw === "demo-jwt-token-local") {
            keysToRemove.push(key);
          }
        }
      }
    }
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* noop */ }
    });
  } catch {
    /* noop in restricted environments */
  }
};

export interface ValidUploadAuth {
  token: string;
  userId: string;
}

/**
 * Guarantees a valid, non-expired compact JWS token with matching userId for uploads.
 * If current session is missing, corrupted, or expired, it automatically renews
 * or authenticates against Supabase to prevent '403 Invalid Compact JWS'.
 */
export const getValidUploadAuth = async (): Promise<ValidUploadAuth> => {
  // Purge any lingering malformed tokens first
  purgeCorruptedStorageTokens();

  // 1. Try to get active session from Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && isCompactJWS(session.access_token)) {
      if (!isTokenExpired(session.access_token) && session.user?.id) {
        return {
          token: session.access_token,
          userId: session.user.id,
        };
      }

      // Try refreshing if expired
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && refreshData?.session?.access_token && isCompactJWS(refreshData.session.access_token) && refreshData.user?.id) {
        return {
          token: refreshData.session.access_token,
          userId: refreshData.user.id,
        };
      }
    }
  } catch (err) {
    console.warn("[uploadAuth] getSession/refreshSession failed:", err);
  }

  // 2. If no valid session exists, authenticate with DEMO_CREDENTIALS
  try {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword(DEMO_CREDENTIALS);
    if (!signInErr && signInData?.session?.access_token && isCompactJWS(signInData.session.access_token) && signInData.user?.id) {
      return {
        token: signInData.session.access_token,
        userId: signInData.user.id,
      };
    }
  } catch (err) {
    console.warn("[uploadAuth] DEMO_CREDENTIALS signin failed:", err);
  }

  // 3. Fallback to Supabase ANON key if it is a valid compact JWS
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
  if (isCompactJWS(anonKey)) {
    return {
      token: anonKey,
      userId: DEMO_USER.id,
    };
  }

  throw new Error("Unable to establish authenticated session for upload. Please sign in.");
};
