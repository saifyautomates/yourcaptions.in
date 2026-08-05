// Centralized auth error logging.
//
// Every auth operation (sign-in, sign-up, password reset, password update,
// OAuth) gets a stable request ID that follows it through the trail, is
// surfaced in toasts / diagnostics panel, and is forwarded to the `log-error`
// edge function so recurring sign-in failures show up in the admin Error
// Monitoring dashboard (`/dashboard/errors`) filtered by `function_name=auth`.

import { supabase } from "@/integrations/supabase/client";
import { logOAuth } from "@/lib/oauthDebug";
import { reportError } from "@/lib/errorMonitor";

export type AuthMethod =
  | "password-signin"
  | "password-signup"
  | "password-reset-request"
  | "password-update"
  | "oauth-google"
  | "oauth-callback"
  | "session-check"
  | "sign-out";

export type AuthStage =
  | "initiate"
  | "provider-redirect"
  | "callback"
  | "code-exchange"
  | "session-hydrate"
  | "complete";

interface AuthErrorInput {
  method: AuthMethod;
  stage: AuthStage;
  error: unknown;
  requestId?: string;
  context?: Record<string, unknown>;
  /** Elevate to critical when the failure blocks the user entirely. */
  severity?: "warning" | "error" | "critical";
}

const RID_KEY = "auth_request_ids";
const RID_MAX = 40;

/** rid_<timestamp>_<random> — short enough for a toast, unique enough for search. */
export function newAuthRequestId(prefix = "rid"): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  const rid = `${prefix}_${t}_${r}`;
  try {
    const raw = sessionStorage.getItem(RID_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    arr.push(rid);
    sessionStorage.setItem(RID_KEY, JSON.stringify(arr.slice(-RID_MAX)));
  } catch { /* storage disabled */ }
  return rid;
}

export function getRecentAuthRequestIds(): string[] {
  try {
    const raw = sessionStorage.getItem(RID_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

interface NormalizedError {
  message: string;
  status: number | null;
  code: string | null;
  name: string | null;
  supabaseRequestId: string | null;
  raw: unknown;
}

function normalize(err: unknown): NormalizedError {
  if (!err) return { message: "unknown error", status: null, code: null, name: null, supabaseRequestId: null, raw: err };
  const anyErr = err as Record<string, unknown>;
  const message =
    (typeof anyErr.message === "string" && anyErr.message) ||
    (typeof err === "string" ? err : "") ||
    "Auth error";
  return {
    message: String(message),
    status: (anyErr.status as number) ?? (anyErr.statusCode as number) ?? null,
    code: (anyErr.code as string) ?? (anyErr.error_code as string) ?? null,
    name: (anyErr.name as string) ?? null,
    supabaseRequestId:
      (anyErr.requestId as string) ??
      (anyErr.request_id as string) ??
      null,
    raw: err,
  };
}

export type AuthErrorCategory =
  | "jwt"           // stale/malformed token, missing sub claim, signing-key rotation
  | "rls"           // row-level-security / permission denied on a downstream call
  | "stale-route"   // linked/bookmarked resource that no longer exists or isn't yours
  | "credentials"   // wrong email/password or account not found
  | "unconfirmed"   // email confirmation still required
  | "rate-limit"    // too many attempts
  | "network"       // fetch failure / offline
  | "oauth"         // provider popup closed, cookie blocked, redirect mismatch
  | "unknown";

export interface LoggedAuthError extends NormalizedError {
  requestId: string;
  method: AuthMethod;
  stage: AuthStage;
  friendly: string;
  category: AuthErrorCategory;
  categoryLabel: string;
  recovery: RecoveryAction[];
}

/** Classify the failure so the UI can show a precise badge (JWT / RLS / …). */
export function categorizeAuthError(n: NormalizedError, method: AuthMethod): AuthErrorCategory {
  const m = (n.message || "").toLowerCase();
  const code = (n.code || "").toLowerCase();
  if (
    code === "bad_jwt" ||
    /invalid claim|missing sub|jwt (expired|malformed|invalid)|jws|jwk/i.test(m)
  ) return "jwt";
  if (
    n.status === 401 ||
    n.status === 403 ||
    /row.?level.?security|permission denied|not authorized|rls|policy/i.test(m)
  ) {
    // 401/403 on an auth endpoint is really a JWT problem; only classify as
    // RLS when the message clearly names the policy layer.
    if (/row.?level|policy|permission/i.test(m)) return "rls";
  }
  // Credentials must be checked before stale-route: "User not found" contains
  // the words "not found" but is an auth credential failure, not a stale link.
  if (/invalid.*credentials|invalid.*login|invalid password|user.*not.*found|user.*already/i.test(m))
    return "credentials";
  if (
    n.status === 404 ||
    /pgrst116|no rows|not found|does not exist|invalid.*(project|resource)/i.test(m)
  ) return "stale-route";
  if (n.status === 429 || /rate/i.test(m)) return "rate-limit";
  if (n.code === "email_not_confirmed" || /confirm/i.test(m)) return "unconfirmed";
  if (/network|fetch|failed to fetch|offline/i.test(m)) return "network";
  if (method.startsWith("oauth") || /popup|closed|cancel|redirect_uri|provider/i.test(m)) return "oauth";
  return "unknown";
}

const CATEGORY_LABELS: Record<AuthErrorCategory, string> = {
  jwt: "Session token issue (JWT)",
  rls: "Access denied (RLS policy)",
  "stale-route": "Stale link or missing resource",
  credentials: "Wrong email or password",
  unconfirmed: "Email not confirmed",
  "rate-limit": "Too many attempts",
  network: "Network problem",
  oauth: "OAuth provider issue",
  unknown: "Sign-in failed",
};

/**
 * User-friendly translation for the common auth failures. Falls back to the
 * raw provider message when nothing matches so we never hide info.
 */
export function friendlyAuthMessage(n: NormalizedError, method: AuthMethod): string {
  const cat = categorizeAuthError(n, method);
  const m = n.message.toLowerCase();
  switch (cat) {
    case "jwt":
      return "Your saved session is stale or invalid. We've cleared it — please sign in again.";
    case "rls":
      return "Signed in, but this account isn't allowed to access that resource.";
    case "stale-route":
      return "That link points to a project or page that no longer exists (or belongs to a different account).";
    case "rate-limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "unconfirmed":
      return "Please confirm your email address before signing in.";
    case "credentials":
      if (/user.*not.*found/i.test(m)) return "No account matches that email.";
      if (/user.*already/i.test(m)) return "An account with this email already exists.";
      return "Email or password is incorrect.";
    case "network":
      return "Network hiccup. Check your connection and retry.";
    case "oauth":
      if (/popup|closed|cancel/i.test(m)) return "Google sign-in was cancelled.";
      return "The OAuth provider rejected the sign-in. Please try again.";
    default:
      if (/password.*(weak|short|min)/i.test(m)) return "Password is too weak — use at least 8 characters.";
      return n.message || "Authentication failed.";
  }
}

/** What the user can do to unstick themselves. Drives inline recovery UI. */
export type RecoveryAction =
  | "retry"
  | "reset-password"
  | "resend-confirmation"
  | "try-google"
  | "create-account"
  | "check-network"
  | "wait-and-retry"
  | "clear-session"
  | "go-dashboard"
  | "contact-support";

export function recoveryActionsFor(n: NormalizedError, method: AuthMethod): RecoveryAction[] {
  const cat = categorizeAuthError(n, method);
  const m = n.message.toLowerCase();
  switch (cat) {
    case "jwt":         return ["clear-session", "retry"];
    case "rls":         return ["go-dashboard", "contact-support"];
    case "stale-route": return ["go-dashboard", "retry"];
    case "rate-limit":  return ["wait-and-retry"];
    case "unconfirmed": return ["resend-confirmation", "retry"];
    case "credentials":
      if (/user.*not.*found/i.test(m)) return ["create-account", "try-google"];
      if (/user.*already/i.test(m)) return ["reset-password"];
      return ["retry", "reset-password", "try-google"];
    case "network":     return ["check-network", "retry"];
    case "oauth":       return ["retry", "try-google"];
    default:
      if (/password.*(weak|short|min)/i.test(m)) return ["retry"];
      return ["retry", "contact-support"];
  }
}

/**
 * Log an auth failure everywhere it matters: console, OAuth trail (for the
 * diagnostics panel), and the centralized `error_logs` table via the
 * `log-error` edge function. Returns the enriched record so callers can
 * surface `requestId` in their UI.
 */
export function logAuthError(input: AuthErrorInput): LoggedAuthError {
  const n = normalize(input.error);
  const requestId = input.requestId ?? newAuthRequestId();
  const friendly = friendlyAuthMessage(n, input.method);
  const recovery = recoveryActionsFor(n, input.method);
  const category = categorizeAuthError(n, input.method);
  const record: LoggedAuthError = {
    ...n, requestId, method: input.method, stage: input.stage,
    friendly, recovery, category, categoryLabel: CATEGORY_LABELS[category],
  };

   
  const isCancelled = category === "oauth" && /popup|closed|cancel/i.test(n.message.toLowerCase());

  console.error(`[auth:${input.method}:${input.stage}] ${friendly}`, {
    requestId,
    status: n.status,
    code: n.code,
    supabaseRequestId: n.supabaseRequestId,
    raw: n.raw,
  });

  logOAuth("initiate-error", {
    requestId,
    method: input.method,
    stage: input.stage,
    message: n.message,
    status: n.status,
    code: n.code,
    supabaseRequestId: n.supabaseRequestId,
  });

  // Fire-and-forget centralized report. `function_name = "auth"` lets the
  // ErrorLogs page filter to auth-only failures.
  if (!isCancelled) {
    void reportError(n.message || friendly, {
      severity: input.severity ?? "error",
      source: "frontend",
      functionName: "auth",
      context: {
        request_id: requestId,
        supabase_request_id: n.supabaseRequestId,
        method: input.method,
        stage: input.stage,
        status: n.status,
        code: n.code,
        name: n.name,
        ...(input.context ?? {}),
      },
    });
  }

  return record;
}

/** Convenience: log a successful auth step to the trail for correlation. */
export function logAuthSuccess(method: AuthMethod, stage: AuthStage, requestId: string, detail?: Record<string, unknown>) {
  logOAuth("session-created", { requestId, method, stage, ...(detail ?? {}) });
}

/**
 * Track sign-in failure frequency in-process so the UI can flag repeated
 * failures ("3rd failure in 60s") without waiting for the admin dashboard.
 */
const RECENT: { t: number; method: AuthMethod }[] = [];
export function recordAndCheckRecurrence(method: AuthMethod, windowMs = 60_000): number {
  const now = Date.now();
  while (RECENT.length && now - RECENT[0].t > windowMs) RECENT.shift();
  RECENT.push({ t: now, method });
  return RECENT.filter((r) => r.method === method).length;
}

/** Ask the backend for auth error stats over a recent window. */
export async function fetchRecentAuthErrorStats(sinceMs = 60 * 60 * 1000) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { data, error } = await supabase
    .from("error_logs")
    .select("id, message, severity, occurrence_count, last_seen_at, context")
    .eq("function_name", "auth")
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (error) return { data: [], error };
  return { data: data ?? [], error: null };
}
