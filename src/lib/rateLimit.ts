// Small event bus for surfacing 429 rate-limit cooldowns to any listening UI.
// Edge functions return a plain error message containing "rate_limit" and the
// window ("minute" / "hour" / "day"). We map the window to a coarse cooldown
// (the worst case wait until that window resets).

export type RateLimitWindow = "minute" | "hour" | "day";

export type RateLimitEvent = {
  window: RateLimitWindow;
  seconds: number;      // cooldown in seconds
  endsAt: number;       // ms epoch
  fn?: string;          // edge function name, if known
  message: string;
};

const WINDOW_SECONDS: Record<RateLimitWindow, number> = {
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
};

type Listener = (evt: RateLimitEvent) => void;
const listeners = new Set<Listener>();

export function subscribeRateLimit(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(evt: RateLimitEvent) {
  for (const l of listeners) l(evt);
}

/**
 * Inspect an error from `supabase.functions.invoke` (or any thrown error) and
 * detect a 429 rate-limit response. Emits a rate-limit event and returns true
 * if handled — caller can skip its own toast in that case.
 */
export function detectRateLimit(err: unknown, fn?: string): boolean {
  if (!err) return false;
  const anyErr = err as {
    message?: string;
    context?: { status?: number };
    status?: number;
  };
  const status = anyErr.context?.status ?? anyErr.status;
  const msg = String(anyErr.message ?? "");
  const looks429 = status === 429 || /rate.?limit/i.test(msg) || /too many requests/i.test(msg);
  if (!looks429) return false;

  const window: RateLimitWindow = /minute/i.test(msg) ? "minute"
                                 : /hour/i.test(msg)   ? "hour"
                                 : "day";
  const seconds = WINDOW_SECONDS[window];
  const evt: RateLimitEvent = {
    window,
    seconds,
    endsAt: Date.now() + seconds * 1000,
    fn,
    message: msg || `Rate limit hit for this ${window}.`,
  };
  emit(evt);
  // Best-effort: forward to PostHog/Sentry for abuse monitoring.
  // Imported lazily so this module stays framework-free.
  import("./observability")
    .then(({ trackRateLimit }) =>
      trackRateLimit({ fn, window, seconds, message: evt.message }),
    )
    .catch(() => {});
  return true;
}
