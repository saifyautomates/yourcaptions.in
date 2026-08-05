/**
 * Lightweight performance monitor for the editor.
 *
 * Captures three signals that matter on low-end / mobile devices:
 *   1. Long tasks (>50ms on the main thread) — jank source
 *   2. Interaction latency (event → next paint) — INP-like
 *   3. Sustained frame rate over a rolling 2s window
 *
 * Samples are kept in-memory (bounded ring buffer) and mirrored to
 * `localStorage["perf:samples"]` so they survive a reload for inspection.
 * PerfHUD / DevTools can read `window.__perf` at any time.
 */

export interface PerfSample {
  t: number;
  longTasksMs: number;   // total blocking time in the last window
  inpMs: number;         // worst interaction latency observed
  fps: number;           // approximate FPS in the last second
}

interface PerfState {
  samples: PerfSample[];
  worstInp: number;
  stop: () => void;
}

const RING = 120; // ~4 minutes at 1 sample / 2s

declare global {
  interface Window { __perf?: PerfState }
}

let started = false;

export function startPerfMonitor(): PerfState | undefined {
  if (typeof window === "undefined") return;
  if (started && window.__perf) return window.__perf;
  started = true;

  const samples: PerfSample[] = [];
  let longTaskBudget = 0;
  let worstInp = 0;

  // 1. Long tasks
  let longTaskObs: PerformanceObserver | undefined;
  try {
    longTaskObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTaskBudget += entry.duration;
    });
    longTaskObs.observe({ type: "longtask", buffered: true });
  } catch { /* Safari / older browsers */ }

  // 2. Interaction latency (Event Timing)
  let eventObs: PerformanceObserver | undefined;
  try {
    eventObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (entry.duration > worstInp) worstInp = entry.duration;
      }
    });
    // durationThreshold filters trivial events
    (eventObs as any).observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch { /* older browsers */ }

  // 3. FPS via rAF
  let frames = 0;
  let fpsWindowStart = performance.now();
  let currentFps = 60;
  let raf = 0;
  const tick = () => {
    frames++;
    const now = performance.now();
    if (now - fpsWindowStart >= 1000) {
      currentFps = Math.round((frames * 1000) / (now - fpsWindowStart));
      frames = 0;
      fpsWindowStart = now;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // Emit a sample every 2s
  const interval = window.setInterval(() => {
    const s: PerfSample = {
      t: Date.now(),
      longTasksMs: Math.round(longTaskBudget),
      inpMs: Math.round(worstInp),
      fps: currentFps,
    };
    samples.push(s);
    if (samples.length > RING) samples.shift();
    longTaskBudget = 0;
    try {
      // Persist last 30 for post-mortem debugging
      localStorage.setItem("perf:samples", JSON.stringify(samples.slice(-30)));
    } catch { /* quota / SSR */ }
  }, 2000);

  const state: PerfState = {
    samples,
    get worstInp() { return worstInp; },
    stop() {
      longTaskObs?.disconnect();
      eventObs?.disconnect();
      cancelAnimationFrame(raf);
      clearInterval(interval);
      started = false;
      delete window.__perf;
    },
  };

  window.__perf = state;
  return state;
}

/** Return latest snapshot for HUDs / smoke tests. */
export function readPerfSnapshot(): PerfSample | null {
  const s = window.__perf?.samples;
  return s && s.length ? s[s.length - 1] : null;
}
