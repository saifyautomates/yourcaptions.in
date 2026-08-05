// Global frontend error monitor. Captures window errors, unhandled promise
// rejections, and manual `reportError()` calls, then forwards them to the
// `log-error` edge function. Optionally initialises Sentry if
// `VITE_SENTRY_DSN` is set.

import { supabase } from "@/integrations/supabase/client";

type Severity = "info" | "warning" | "error" | "critical";

interface ReportOptions {
  severity?: Severity;
  context?: Record<string, unknown>;
  source?: "frontend" | "edge_function" | "external";
  functionName?: string;
}

const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 20;
const seenTimes: number[] = [];

function withinRate(): boolean {
  const now = Date.now();
  while (seenTimes.length && now - seenTimes[0] > RATE_WINDOW_MS) seenTimes.shift();
  if (seenTimes.length >= RATE_MAX) return false;
  seenTimes.push(now);
  return true;
}

let currentUserId: string | null = null;

export async function reportError(err: unknown, opts: ReportOptions = {}) {
  try {
    if (!withinRate()) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const payload = {
      message: e.message || "Unknown error",
      stack: e.stack,
      severity: opts.severity ?? "error",
      source: opts.source ?? "frontend",
      function_name: opts.functionName,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      release: import.meta.env.VITE_APP_RELEASE ?? "dev",
      user_id: currentUserId,
      context: opts.context ?? {},
    };
    // Fire-and-forget; never throw from inside the reporter.
    await supabase.functions.invoke("log-error", { body: payload });
  } catch (inner) {
     
    console.warn("[errorMonitor] report failed", inner);
  }
}

export function initErrorMonitor() {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __errMonReady?: boolean }).__errMonReady) return;
  (window as unknown as { __errMonReady?: boolean }).__errMonReady = true;

  supabase.auth.getUser().then(({ data }) => { currentUserId = data.user?.id ?? null; });
  supabase.auth.onAuthStateChange((_e, session) => { currentUserId = session?.user?.id ?? null; });

  window.addEventListener("error", (event) => {
    const msg = String(event.message ?? "");
    // Benign browser noise: fires when layout thrashes inside RO callbacks.
    if (msg.includes("ResizeObserver loop")) return;
    reportError(event.error ?? event.message, {
      severity: "error",
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {
      severity: "error",
      context: { kind: "unhandledrejection" },
    });
  });

  // Optional Sentry init — DSN is a public value so it's safe as a Vite env.
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (dsn) {
    // @vite-ignore + dynamic specifier so the build doesn't require the package
    // to be installed. Add `@sentry/react` (bun add @sentry/react) to enable.
    const spec = "@sentry/react";
    import(/* @vite-ignore */ spec).then((Sentry: { init: (o: Record<string, unknown>) => void }) => {
      Sentry.init({
        dsn,
        release: import.meta.env.VITE_APP_RELEASE ?? "dev",
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
      });
    }).catch(() => {
      // Sentry package not installed — skip silently.
    });
  }
}
