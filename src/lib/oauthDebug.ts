/**
 * OAuth debug logger.
 *
 * Instruments the Google OAuth redirect flow so failures can be pinpointed
 * to a specific stage:
 *   1. initiate           – supabase.auth.signInWithOAuth called
 *   2. provider-redirect  – browser leaves for Google
 *   3. callback-return    – browser lands back with ?code=… / #access_token=…
 *   4. code-exchange      – Supabase exchanges the code
 *   5. session-created    – onAuthStateChange fires SIGNED_IN
 *
 * Everything is timestamped, console-logged, and mirrored to
 * sessionStorage under `oauth_debug_trail` so a user can copy the trail
 * out even after the redirect wipes the console.
 */

export type OAuthStage =
  | "initiate"
  | "initiate-error"
  | "provider-redirect"
  | "callback-return"
  | "code-exchange-start"
  | "code-exchange-success"
  | "code-exchange-error"
  | "session-created"
  | "session-missing"
  | "auth-state-change"
  | "sign-out";

const KEY = "oauth_debug_trail";
const MAX = 60;

export interface OAuthTrailEntry {
  t: string;              // ISO timestamp
  stage: OAuthStage;
  href: string;           // window.location.href at time of event
  detail?: Record<string, unknown>;
}

function readTrail(): OAuthTrailEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OAuthTrailEntry[]) : [];
  } catch {
    return [];
  }
}

function writeTrail(entries: OAuthTrailEntry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* storage full or disabled */
  }
}

export function logOAuth(stage: OAuthStage, detail?: Record<string, unknown>) {
  const entry: OAuthTrailEntry = {
    t: new Date().toISOString(),
    stage,
    href: typeof window !== "undefined" ? window.location.href : "",
    detail,
  };
  const trail = readTrail();
  trail.push(entry);
  writeTrail(trail);
   
  console.info(`[oauth:${stage}]`, entry);
}

export function getOAuthTrail(): OAuthTrailEntry[] {
  return readTrail();
}

export function clearOAuthTrail() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Parses the current URL for OAuth callback markers. Returns null when
 * the URL doesn't look like a provider return.
 */
export function inspectCallbackUrl(url: string = window.location.href) {
  const u = new URL(url);
  const q = u.searchParams;
  const hash = new URLSearchParams(u.hash.replace(/^#/, ""));

  const code = q.get("code");
  const state = q.get("state");
  const providerError = q.get("error") ?? hash.get("error");
  const providerErrorDescription =
    q.get("error_description") ?? hash.get("error_description");
  const accessTokenInHash = hash.get("access_token");
  const refreshTokenInHash = hash.get("refresh_token");
  const type = hash.get("type") ?? q.get("type");

  const isCallback =
    Boolean(code) ||
    Boolean(providerError) ||
    Boolean(accessTokenInHash) ||
    Boolean(refreshTokenInHash);

  if (!isCallback) return null;

  return {
    code: code ? `${code.slice(0, 6)}…(${code.length})` : null,
    state,
    providerError,
    providerErrorDescription,
    hasAccessTokenInHash: Boolean(accessTokenInHash),
    hasRefreshTokenInHash: Boolean(refreshTokenInHash),
    type,
    origin: u.origin,
    path: u.pathname,
  };
}
