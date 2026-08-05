// Run log: per-operation event collector for transcription/export flows.
// Every step is appended with a monotonic timestamp; on failure the caller
// invokes `failWithLog` which reports to the error_logs pipeline AND surfaces
// a toast with a "Download log" action so the user gets a portable .log file
// they can share when opening a support ticket.

import { toast } from "sonner";
import { reportError } from "./errorMonitor";

export type RunKind = "transcription" | "export" | "dub" | "translate";
export type RunLevel = "info" | "warn" | "error";

export interface RunStep {
  t: number;              // ms since run start
  level: RunLevel;
  message: string;
  data?: Record<string, unknown>;
}

export interface RunLog {
  id: string;
  kind: RunKind;
  startedAt: number;      // epoch ms
  steps: RunStep[];
  step: (message: string, data?: Record<string, unknown>, level?: RunLevel) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  toText: () => string;
  download: (filename?: string) => void;
}

function rid(): string {
  try {
    // crypto.randomUUID is standard in modern browsers.
    return (crypto as Crypto & { randomUUID(): string }).randomUUID();
  } catch {
    return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function createRunLog(kind: RunKind, meta?: Record<string, unknown>): RunLog {
  const id = rid();
  const startedAt = Date.now();
  const t0 = performance.now();
  const steps: RunStep[] = [];

  const append = (level: RunLevel, message: string, data?: Record<string, unknown>) => {
    steps.push({ t: Math.round(performance.now() - t0), level, message, data });
     
    if (level === "error") console.error(`[runlog:${kind}]`, message, data ?? "");
    else if (level === "warn") console.warn(`[runlog:${kind}]`, message, data ?? "");
    else console.log(`[runlog:${kind}]`, message, data ?? "");
  };

  const log: RunLog = {
    id,
    kind,
    startedAt,
    steps,
    step: (m, d, level = "info") => append(level, m, d),
    warn: (m, d) => append("warn", m, d),
    error: (m, d) => append("error", m, d),
    toText: () => renderLogText(log, meta),
    download: (filename?: string) => downloadText(
      renderLogText(log, meta),
      filename ?? `${kind}-${id.slice(0, 8)}-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.log`,
    ),
  };

  append("info", `run_start kind=${kind}`, meta);
  return log;
}

function renderLogText(log: RunLog, meta?: Record<string, unknown>): string {
  const header = [
    `# Yourcaptions run log`,
    `run_id     : ${log.id}`,
    `kind       : ${log.kind}`,
    `started_at : ${new Date(log.startedAt).toISOString()}`,
    `finished_at: ${new Date().toISOString()}`,
    `user_agent : ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}`,
    `url        : ${typeof window !== "undefined" ? window.location.href : "n/a"}`,
    meta ? `meta       : ${safeJson(meta)}` : "",
    ``,
    `# steps (t=ms since run start)`,
  ].filter(Boolean);

  const body = log.steps.map(s => {
    const level = s.level.toUpperCase().padEnd(5);
    const t = String(s.t).padStart(7);
    const extra = s.data ? ` ${safeJson(s.data)}` : "";
    return `${t}ms ${level} ${s.message}${extra}`;
  });

  return [...header, ...body, ""].join("\n");
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Report a failure end-to-end:
 * 1. append the error step to the run log,
 * 2. forward to the error_logs pipeline (server-side dedupe + alerting),
 * 3. show a user-facing toast with a "Download log" action.
 * Returns the same error so callers can re-throw if they want.
 */
export function failWithLog(
  log: RunLog,
  err: unknown,
  opts: { title?: string; hint?: string; report?: boolean } = {},
): Error {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : safeJson(err));
  log.error(`run_fail: ${e.message}`, { stack: e.stack });

  if (opts.report !== false) {
    reportError(e, {
      severity: "error",
      functionName: log.kind,
      context: {
        run_id: log.id,
        kind: log.kind,
        steps: log.steps.slice(-25), // tail of the trace
      },
    }).catch(() => { /* noop */ });
  }

  const description = opts.hint ?? friendlyHint(e.message);
  toast.error(opts.title ?? `${titleFor(log.kind)} failed`, {
    description,
    duration: 12000,
    action: {
      label: "Download log",
      onClick: () => log.download(),
    },
  });
  return e;
}

function titleFor(k: RunKind): string {
  switch (k) {
    case "transcription": return "Transcription";
    case "export":        return "Export";
    case "dub":           return "Dubbing";
    case "translate":     return "Translation";
  }
}

function friendlyHint(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("quota") || m.includes("rate_limit")) return "You've hit your plan limit. Top up credits or upgrade to continue.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network hiccup — check your connection and retry.";
  if (m.includes("aborted") || m.includes("cancel")) return "The run was canceled.";
  if (m.includes("unauthorized") || m.includes("401")) return "Session expired. Please sign in again.";
  if (m.includes("413") || m.includes("too large")) return "File is too large for this plan.";
  if (m.includes("timeout")) return "The provider took too long to respond. Please retry.";
  return `${msg}. Download the log for details.`;
}
