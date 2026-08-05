// Lightweight observability shim for the browser. Emits structured events
// for rate-limit hits (429) and quota-exceeded responses (402) to whichever
// of PostHog / Sentry are loaded on `window`. If neither is present the
// helpers are no-ops, so wiring stays safe even before keys are configured.
//
// To activate:
//  - PostHog: load posthog-js and call posthog.init(...) so `window.posthog`
//    is available (or set VITE_POSTHOG_KEY and initialise once at boot).
//  - Sentry:  init the browser SDK so `window.Sentry` is available.

type Props = Record<string, unknown>;

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Props) => void;
      identify?: (id: string, props?: Props) => void;
    };
    Sentry?: {
      captureMessage: (msg: string, ctx?: { level?: string; extra?: Props; tags?: Props }) => void;
      setUser?: (u: { id?: string; email?: string } | null) => void;
    };
  }
}

const safe = <T,>(fn: () => T): T | undefined => {
  try { return fn(); } catch { return undefined; }
};

export function captureEvent(event: string, props: Props = {}) {
  safe(() => window.posthog?.capture(event, props));
  safe(() => window.Sentry?.captureMessage(event, { level: "warning", extra: props, tags: { event } }));
  // Console fallback so events are visible even without SDKs.
  if (typeof console !== "undefined") console.info(`[observability] ${event}`, props);
}

export function identifyUser(u: { id: string; email?: string | null } | null) {
  if (!u) {
    safe(() => window.Sentry?.setUser?.(null));
    return;
  }
  safe(() => window.posthog?.identify?.(u.id, { email: u.email ?? undefined }));
  safe(() => window.Sentry?.setUser?.({ id: u.id, email: u.email ?? undefined }));
}

// Convenience wrappers used by rate-limit / quota code paths.
export const trackRateLimit = (props: Props) => captureEvent("rate_limit_exceeded", props);
export const trackQuotaExceeded = (props: Props) => captureEvent("quota_exceeded", props);
