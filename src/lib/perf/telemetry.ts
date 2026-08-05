/**
 * App-wide performance telemetry.
 *
 *  1. Web Vitals (LCP, INP, CLS, TTFB, FCP) forwarded to the `error_logs`
 *     pipeline as `severity: "info"` / `function_name: "web-vitals"`.
 *  2. React Query timing — every query whose network round-trip exceeds
 *     `SLOW_QUERY_MS` is reported the same way with
 *     `function_name: "react-query"` so slow pages can be traced by key.
 *
 *  Reports are best-effort and rate-limited by the shared reportError
 *  gate, so this is safe to call unconditionally on app boot.
 */

import type { QueryClient, Query } from "@tanstack/react-query";
import { reportError } from "@/lib/errorMonitor";

const SLOW_QUERY_MS = 800;
const VITALS_RATING_ORDER: Record<string, number> = { good: 0, "needs-improvement": 1, poor: 2 };

export function initWebVitals() {
  if (typeof window === "undefined") return;
  if ((window as any).__vitalsReady) return;
  (window as any).__vitalsReady = true;

  void import("web-vitals").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    const send = (metric: {
      name: string;
      value: number;
      rating?: string;
      id?: string;
      navigationType?: string;
    }) => {
      // Only report metrics that are "needs-improvement" or worse to keep
      // volume tiny. Good-rating metrics are still surfaced on window for
      // devtools.
      (window as any).__vitals = { ...(window as any).__vitals, [metric.name]: metric };
      const bad = (VITALS_RATING_ORDER[metric.rating ?? "good"] ?? 0) >= 1;
      if (!bad) return;
      reportError(new Error(`web-vitals:${metric.name}=${Math.round(metric.value)}`), {
        severity: metric.rating === "poor" ? "warning" : "info",
        functionName: "web-vitals",
        context: {
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          navigation_type: metric.navigationType,
          path: window.location.pathname,
        },
      }).catch(() => {});
    };
    onLCP(send);
    onINP(send);
    onCLS(send);
    onFCP(send);
    onTTFB(send);
  }).catch(() => {});
}

export function attachQueryTiming(qc: QueryClient) {
  const cache = qc.getQueryCache();
  const starts = new WeakMap<Query, number>();

  return cache.subscribe((evt) => {
    const q = evt.query;
    if (!q) return;
    const state = q.state;
    if (state.fetchStatus === "fetching" && !starts.has(q)) {
      starts.set(q, performance.now());
      return;
    }
    if (state.fetchStatus === "idle" && starts.has(q)) {
      const t0 = starts.get(q)!;
      starts.delete(q);
      const dur = performance.now() - t0;
      // Track on window for the perf HUD.
      const w = window as any;
      w.__queryTimings = w.__queryTimings ?? [];
      w.__queryTimings.push({ key: q.queryKey, dur, at: Date.now() });
      if (w.__queryTimings.length > 200) w.__queryTimings.shift();
      if (dur < SLOW_QUERY_MS) return;
      reportError(new Error(`slow-query:${JSON.stringify(q.queryKey).slice(0, 120)}=${Math.round(dur)}ms`), {
        severity: dur > 3000 ? "warning" : "info",
        functionName: "react-query",
        context: {
          query_key: q.queryKey,
          duration_ms: Math.round(dur),
          status: state.status,
          path: window.location.pathname,
        },
      }).catch(() => {});
    }
  });
}
