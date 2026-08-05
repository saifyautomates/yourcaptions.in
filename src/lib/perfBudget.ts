// Client-side performance budgets.
//
// We track a small set of critical user-visible operations against fixed
// thresholds. When an operation exceeds its budget we:
//   1. Warn the user with a toast (helps them notice slowness immediately).
//   2. Report the breach to the backend via the `log-error` edge function
//      with source=frontend + severity=warning so it shows up in
//      /dashboard/errors alongside other issues (searchable by `function_name`
//      prefix `perf:`).
//
// Thresholds are intentionally conservative — we'd rather see a warning we
// can dismiss than miss a regression. Adjust here in one place.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type PerfKey = "dashboard_load" | "export_response";

/** Budgets in milliseconds. Exceeding these triggers an alert. */
export const PERF_BUDGETS_MS: Record<PerfKey, number> = {
  dashboard_load: 2500,     // Time from mount to first project list rendered.
  export_response: 15000,   // Time from clicking Export to first byte downloaded.
};

/** Human labels used in toasts + error log messages. */
export const PERF_LABELS: Record<PerfKey, string> = {
  dashboard_load: "Dashboard load",
  export_response: "Video export",
};
const LABELS = PERF_LABELS;

/** Short, human-friendly request id embedded on every perf breach. */
function newRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36).slice(-6);
  return `perf_${t}${rand}`;
}

// De-duplicate reports within a session so a single slow session doesn't
// spam the error log with dozens of identical breaches.
const reportedThisSession = new Set<string>();

async function reportBreach(key: PerfKey, actualMs: number, extra?: Record<string, unknown>) {
  const budget = PERF_BUDGETS_MS[key];
  const fingerprintKey = `${key}:${Math.floor(actualMs / 1000)}s`;
  if (reportedThisSession.has(fingerprintKey)) return;
  reportedThisSession.add(fingerprintKey);

  try {
    await supabase.functions.invoke("log-error", {
      body: {
        fingerprint: `perf:${key}`,
        severity: "warning",
        source: "frontend",
        message: `${LABELS[key]} exceeded ${budget}ms budget (took ${Math.round(actualMs)}ms)`,
        function_name: `perf:${key}`,
        url: typeof window !== "undefined" ? window.location.href : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        context: { actual_ms: Math.round(actualMs), budget_ms: budget, ...(extra ?? {}) },
      },
    });
  } catch {
    // Never let telemetry failures interrupt the user's flow.
  }
}

/**
 * Start a measurement. Returns an `end()` function that finalises the timing.
 * If the elapsed time exceeds the budget, it toasts the user AND reports
 * the breach to the backend. Safe to call from server-side render paths —
 * falls back to Date.now() when `performance` is unavailable.
 */
export function startPerfMeasure(key: PerfKey, extra?: Record<string, unknown>) {
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const t0 = now();
  const requestId = newRequestId();
  let ended = false;
  return {
    /** The stable id used to correlate this measurement across UI + logs. */
    requestId,
    /** Finalise the timer. Returns the elapsed ms. */
    end(finalExtra?: Record<string, unknown>) {
      if (ended) return 0;
      ended = true;
      const elapsed = now() - t0;
      const budget = PERF_BUDGETS_MS[key];
      if (elapsed > budget) {
        const overshoot = Math.round(elapsed - budget);
        toast.warning(`${LABELS[key]} took longer than expected`, {
          description: `${Math.round(elapsed)}ms (budget ${budget}ms, +${overshoot}ms over) · req ${requestId}`,
          duration: 6000,
        });
        void reportBreach(key, elapsed, {
          request_id: requestId,
          ...(extra ?? {}),
          ...(finalExtra ?? {}),
        });
      }
      return elapsed;
    },
    /** Abandon the timer without reporting (e.g. user navigated away). */
    cancel() { ended = true; },
  };
}
