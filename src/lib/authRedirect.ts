import { logOAuth } from "./oauthDebug";

/**
 * Public authentication paths. Redirecting an authenticated user to any of these
 * paths causes a redirect loop (PublicOnlyRoute -> ProtectedRoute -> PublicOnlyRoute).
 */
export const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/signin",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

/**
 * Validates and sanitizes redirect destination URLs.
 *
 * Rules:
 * 1. Must be a non-empty string starting with '/' and NOT '//' (prevents open redirects).
 * 2. Must not contain absolute scheme protocols (http:, https:, javascript:, etc.).
 * 3. The target path must NOT be a public auth route (/login, /signup, etc.).
 * 4. Falls back to defaultPath (default: '/dashboard') if validation fails.
 */
export function sanitizeRedirectUrl(target?: string | null, defaultPath = "/dashboard"): string {
  if (!target || typeof target !== "string") {
    return defaultPath;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return defaultPath;
  }

  // Prevent protocol-relative links e.g. //evil.com
  if (trimmed.startsWith("//")) {
    logOAuth("redirect-validation-failed", { reason: "protocol-relative-url", raw: trimmed });
    return defaultPath;
  }

  // Must start with '/'
  if (!trimmed.startsWith("/")) {
    logOAuth("redirect-validation-failed", { reason: "not-relative-path", raw: trimmed });
    return defaultPath;
  }

  // Prevent URL scheme prefixes like javascript: or https:
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    logOAuth("redirect-validation-failed", { reason: "contains-scheme", raw: trimmed });
    return defaultPath;
  }

  try {
    // Parse on dummy base to safely extract pathname
    const dummyBase = "http://localhost";
    const parsed = new URL(trimmed, dummyBase);
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";

    if (PUBLIC_AUTH_PATHS.has(pathname)) {
      logOAuth("redirect-validation-sanitized", {
        reason: "public-auth-path-rejected",
        raw: trimmed,
        sanitizedTo: defaultPath,
      });
      return defaultPath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (err) {
    logOAuth("redirect-validation-failed", { reason: "parse-error", raw: trimmed, error: String(err) });
    return defaultPath;
  }
}
