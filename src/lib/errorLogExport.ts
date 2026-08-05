/**
 * Pure helpers behind the /dashboard/errors CSV/JSON export.
 *
 * Extracted from ErrorLogs.tsx so we can unit-test three edge cases the
 * production export must handle:
 *   1. Empty filter result (no rows) — callers should short-circuit.
 *   2. Special characters in the search query and row payloads —
 *      commas, quotes, CR/LF, unicode, regex metachars, nested JSON.
 *   3. Large result sets — no truncation, no row loss.
 */

export type Severity = "info" | "warning" | "error" | "critical";
export type Source = "frontend" | "edge_function" | "database" | "external";

export interface ErrorRow {
  id: string;
  fingerprint: string;
  severity: Severity;
  source: Source;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  function_name: string | null;
  user_id: string | null;
  context: Record<string, unknown>;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved: boolean;
  resolved_at: string | null;
}

export const CSV_COLUMNS: (keyof ErrorRow)[] = [
  "last_seen_at", "first_seen_at", "severity", "source", "function_name",
  "message", "occurrence_count", "resolved", "resolved_at",
  "fingerprint", "url", "user_id", "user_agent", "stack",
];

/**
 * Default human-friendly CSV column headers. Applied automatically to any
 * key emitted in the CSV header row (base columns + enrichment columns).
 * Callers may override or extend via `ExportStreamOptions.headerLabels`.
 */
export const CSV_HEADER_LABELS: Record<string, string> = {
  last_seen_at: "Last Seen",
  first_seen_at: "First Seen",
  severity: "Severity",
  source: "Source",
  function_name: "Function",
  message: "Message",
  occurrence_count: "Occurrences",
  resolved: "Resolved",
  resolved_at: "Resolved At",
  fingerprint: "Fingerprint",
  url: "URL",
  user_id: "User ID",
  user_agent: "User Agent",
  stack: "Stack Trace",
  context: "Context",
  // Perf enrichment fields
  perf_metric: "Perf Metric",
  perf_metric_label: "Perf Metric Label",
  perf_measured_ms: "Measured Duration (ms)",
  perf_threshold_ms: "Threshold (ms)",
  perf_over_ms: "Over Budget (ms)",
  perf_over_pct: "Over Budget (%)",
  request_id: "Request ID",
};

/** RFC-4180 style cell escape: quote when the value contains `,`, `"`, CR or LF. */
export const escapeCsvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Case-insensitive substring search across message/url/function_name/stack. */
export const filterBySearch = (rows: ErrorRow[], query: string): ErrorRow[] => {
  const s = query.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) =>
    r.message.toLowerCase().includes(s) ||
    (r.url ?? "").toLowerCase().includes(s) ||
    (r.function_name ?? "").toLowerCase().includes(s) ||
    (r.stack ?? "").toLowerCase().includes(s),
  );
};

export const buildCsv = (
  rows: ErrorRow[],
  headerLabels?: Record<string, string>,
): string => {
  const labels = { ...CSV_HEADER_LABELS, ...(headerLabels ?? {}) };
  const headerKeys = [...CSV_COLUMNS, "context"];
  const header = headerKeys.map((k) => escapeCsvCell(labels[k] ?? k)).join(",");
  const body = rows.map((r) =>
    [...CSV_COLUMNS.map((c) => escapeCsvCell(r[c])), escapeCsvCell(r.context)].join(","),
  ).join("\r\n");
  return `${header}\r\n${body}\r\n`;
};

export const buildJson = (rows: ErrorRow[]): string =>
  JSON.stringify(rows, null, 2);

/** Extra per-row fields appended to CSV / merged into JSON exports. */
export type ExportExtras = Record<string, unknown>;
export type ExportEnrichFn = (row: ErrorRow) => ExportExtras | null | undefined;

/**
 * Build an export payload in chunks, yielding to the event loop between
 * batches so large result sets do not freeze the UI. Reports progress
 * (0..1) via the optional callback and supports co-operative cancellation.
 *
 * When `enrich` is supplied, its returned fields are:
 *   - CSV: appended as extra columns (union of keys across rows, stable
 *     order; `extraColumns` takes precedence when provided).
 *   - JSON: merged into each row object (existing ErrorRow keys win).
 */
export async function buildExportChunked(
  rows: ErrorRow[],
  format: "csv" | "json",
  opts: {
    chunkSize?: number;
    onProgress?: (fraction: number, done: number, total: number) => void;
    signal?: AbortSignal;
    enrich?: ExportEnrichFn;
    extraColumns?: string[];
    headerLabels?: Record<string, string>;
  } = {},
): Promise<string> {
  const total = rows.length;
  const chunkSize = Math.max(200, opts.chunkSize ?? 1000);
  const { onProgress, signal, enrich } = opts;
  const yieldNow = () =>
    new Promise<void>((resolve) => {
      const w = typeof window !== "undefined" ? (window as any) : undefined;
      if (w?.scheduler?.yield) w.scheduler.yield().then(resolve);
      else if (w?.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 32 });
      else setTimeout(resolve, 0);
    });

  onProgress?.(total === 0 ? 1 : 0, 0, total);

  const extras: (ExportExtras | null)[] = enrich ? rows.map((r) => enrich(r) ?? null) : [];
  const extraColumns: string[] = (() => {
    if (!enrich) return [];
    const seen = new Set<string>(opts.extraColumns ?? []);
    const cols: string[] = [...(opts.extraColumns ?? [])];
    for (const e of extras) {
      if (!e) continue;
      for (const k of Object.keys(e)) {
        if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
    }
    return cols;
  })();

  if (format === "csv") {
    const labels = { ...CSV_HEADER_LABELS, ...(opts.headerLabels ?? {}) };
    const headerKeys = [...CSV_COLUMNS, "context", ...extraColumns];
    const parts: string[] = [headerKeys.map((k) => escapeCsvCell(labels[k] ?? k)).join(",")];
    for (let i = 0; i < total; i += chunkSize) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const end = Math.min(i + chunkSize, total);
      for (let j = i; j < end; j++) {
        const r = rows[j];
        const extra = extras[j] ?? {};
        parts.push(
          [
            ...CSV_COLUMNS.map((c) => escapeCsvCell(r[c])),
            escapeCsvCell(r.context),
            ...extraColumns.map((c) => escapeCsvCell((extra as any)[c])),
          ].join(","),
        );
      }
      onProgress?.(end / total, end, total);
      await yieldNow();
    }
    return parts.join("\r\n") + "\r\n";
  }

  if (total === 0) return "[]";
  const pieces: string[] = ["[\n"];
  for (let i = 0; i < total; i += chunkSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(i + chunkSize, total);
    const bodyParts: string[] = [];
    for (let j = i; j < end; j++) {
      const r = rows[j];
      const extra = extras[j];
      const obj = extra ? { ...extra, ...r } : r;
      bodyParts.push("  " + JSON.stringify(obj));
    }
    pieces.push(bodyParts.join(",\n"));
    if (end < total) pieces.push(",\n");
    onProgress?.(end / total, end, total);
    await yieldNow();
  }
  pieces.push("\n]");
  return pieces.join("");
}

// ─── Streaming export (large result sets) ─────────────────────────────
// The helpers below emit the same payload as `buildExportChunked` but
// yield the text in pieces so callers can pipe them into a Blob (from an
// array of parts — no giant string concat) or directly into a
// FileSystemWritableFileStream via the File System Access API. This
// keeps peak memory ~O(chunkSize) instead of O(total payload size),
// which is what lets multi-hundred-MB exports finish without hanging.

export interface ExportStreamOptions {
  chunkSize?: number;
  onProgress?: (fraction: number, done: number, total: number) => void;
  signal?: AbortSignal;
  enrich?: ExportEnrichFn;
  extraColumns?: string[];
  /** Override or extend CSV header labels. Merged over `CSV_HEADER_LABELS`. */
  headerLabels?: Record<string, string>;
}

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => {
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    if (w?.scheduler?.yield) w.scheduler.yield().then(resolve);
    else if (w?.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 32 });
    else setTimeout(resolve, 0);
  });

/** Async iterator yielding string chunks that concatenate to the full export. */
export async function* iterateExportChunks(
  rows: ErrorRow[],
  format: "csv" | "json",
  opts: ExportStreamOptions = {},
): AsyncGenerator<string, void, void> {
  const total = rows.length;
  const chunkSize = Math.max(200, opts.chunkSize ?? 1000);
  const { onProgress, signal, enrich } = opts;

  onProgress?.(total === 0 ? 1 : 0, 0, total);

  const extras: (ExportExtras | null)[] = enrich ? rows.map((r) => enrich(r) ?? null) : [];
  const extraColumns: string[] = (() => {
    if (!enrich) return [];
    const seen = new Set<string>(opts.extraColumns ?? []);
    const cols: string[] = [...(opts.extraColumns ?? [])];
    for (const e of extras) {
      if (!e) continue;
      for (const k of Object.keys(e)) if (!seen.has(k)) { seen.add(k); cols.push(k); }
    }
    return cols;
  })();

  if (format === "csv") {
    const labels = { ...CSV_HEADER_LABELS, ...(opts.headerLabels ?? {}) };
    const headerKeys = [...CSV_COLUMNS, "context", ...extraColumns];
    yield headerKeys.map((k) => escapeCsvCell(labels[k] ?? k)).join(",") + "\r\n";
    for (let i = 0; i < total; i += chunkSize) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const end = Math.min(i + chunkSize, total);
      const lines: string[] = [];
      for (let j = i; j < end; j++) {
        const r = rows[j];
        const extra = extras[j] ?? {};
        lines.push(
          [
            ...CSV_COLUMNS.map((c) => escapeCsvCell(r[c])),
            escapeCsvCell(r.context),
            ...extraColumns.map((c) => escapeCsvCell((extra as any)[c])),
          ].join(","),
        );
      }
      yield lines.join("\r\n") + "\r\n";
      onProgress?.(end / total, end, total);
      await yieldToEventLoop();
    }
    return;
  }

  // JSON — stream a valid array literal in pieces.
  if (total === 0) { yield "[]"; return; }
  yield "[\n";
  for (let i = 0; i < total; i += chunkSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(i + chunkSize, total);
    const body: string[] = [];
    for (let j = i; j < end; j++) {
      const r = rows[j];
      const extra = extras[j];
      const obj = extra ? { ...extra, ...r } : r;
      body.push("  " + JSON.stringify(obj));
    }
    yield body.join(",\n") + (end < total ? ",\n" : "");
    onProgress?.(end / total, end, total);
    await yieldToEventLoop();
  }
  yield "\n]";
}

/**
 * Build a Blob without ever materialising the payload as a single string.
 * Blob's constructor holds the array of parts directly, so peak memory
 * stays proportional to `chunkSize`, not to the total export size.
 */
export async function buildExportBlob(
  rows: ErrorRow[],
  format: "csv" | "json",
  opts: ExportStreamOptions = {},
): Promise<Blob> {
  const parts: BlobPart[] = [];
  for await (const chunk of iterateExportChunks(rows, format, opts)) {
    parts.push(chunk);
  }
  const type = format === "json" ? "application/json" : "text/csv;charset=utf-8";
  return new Blob(parts, { type });
}

/**
 * True streaming path: writes UTF-8 encoded chunks directly into a
 * FileSystemWritableFileStream (File System Access API). Peak memory
 * stays bounded even for 100k+ row exports because chunks are flushed
 * to disk between yields.
 */
export async function streamExportToWritable(
  rows: ErrorRow[],
  format: "csv" | "json",
  writable: { write: (data: BufferSource | Blob | string) => Promise<void>; close: () => Promise<void>; abort?: (reason?: unknown) => Promise<void> },
  opts: ExportStreamOptions = {},
): Promise<void> {
  const encoder = new TextEncoder();
  try {
    for await (const chunk of iterateExportChunks(rows, format, opts)) {
      await writable.write(encoder.encode(chunk));
    }
    await writable.close();
  } catch (err) {
    try { await writable.abort?.(err); } catch { /* ignore */ }
    throw err;
  }
}

// ─── Filename builder ────────────────────────────────────────────────────
// Produces safe, deterministic download names shared by CSV and JSON
// exports. Keep purely functional so the same call always yields the
// same string — that is what the tests lock in.

export type ExportStatus = "open" | "resolved" | "all";
export type ExportFormat = "csv" | "json";

export interface ExportFilenameInput {
  format: ExportFormat;
  status: ExportStatus;
  authOnly: boolean;
  severity?: "all" | Severity;
  source?: "all" | Source;
  /** Time window in ms (0 or omitted means "all time"). */
  rangeMs?: number;
  /** Free-text search query — sanitised + truncated in the filename. */
  query?: string;
  /** Whether the perf-only toggle is on. */
  perfOnly?: boolean;
  /** Perf threshold key filter, e.g. "dashboard_load"; "all" means no filter. */
  perfKey?: string;
  /** Perf measured-duration range in ms (parsed numbers, not strings). */
  perfMinMs?: number | null;
  perfMaxMs?: number | null;
  date?: Date;
}

// UTC ISO stamp, filesystem-safe (no colons / dots).
// Example: 2026-07-19T15-30-45
export const formatExportStamp = (d: Date): string => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new RangeError("formatExportStamp: invalid Date");
  }
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
};

// Lower-case, keeps [a-z0-9], collapses everything else into a single "-",
// trims leading/trailing separators. Used to sanitise user-controlled or
// enum-controlled tokens before they touch the filename.
export const sanitizeFilenameToken = (raw: string): string =>
  String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const MAX_FILENAME_LEN = 120;

// Compact human-ish label for a time window, e.g. 3600000 -> "1h".
export const formatRangeToken = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return "all-time";
  const s = Math.round(ms / 1000);
  const units: [number, string][] = [
    [86400, "d"], [3600, "h"], [60, "m"], [1, "s"],
  ];
  for (const [size, suffix] of units) {
    if (s >= size && s % size === 0) return `${s / size}${suffix}`;
  }
  return `${s}s`;
};

export const buildExportFilename = (input: ExportFilenameInput): string => {
  const {
    format, status, authOnly,
    severity = "all", source = "all",
    rangeMs, query, perfOnly, perfKey = "all",
    perfMinMs, perfMaxMs, date,
  } = input;

  if (format !== "csv" && format !== "json") {
    throw new RangeError(`buildExportFilename: unsupported format "${format}"`);
  }
  const validStatus: ExportStatus[] = ["open", "resolved", "all"];
  if (!validStatus.includes(status)) {
    throw new RangeError(`buildExportFilename: unsupported status "${status}"`);
  }

  const stamp = formatExportStamp(date ?? new Date());
  const parts = [
    authOnly ? "auth" : "errors",
    sanitizeFilenameToken(status),
  ];
  if (severity && severity !== "all") parts.push(sanitizeFilenameToken(severity));
  if (source && source !== "all") parts.push(sanitizeFilenameToken(source));
  if (typeof rangeMs === "number" && rangeMs > 0) {
    parts.push(sanitizeFilenameToken(formatRangeToken(rangeMs)));
  }
  if (perfOnly) parts.push("perf");
  if (perfKey && perfKey !== "all") parts.push(sanitizeFilenameToken(perfKey));
  if (typeof perfMinMs === "number" && Number.isFinite(perfMinMs)) {
    parts.push(`min${Math.max(0, Math.round(perfMinMs))}ms`);
  }
  if (typeof perfMaxMs === "number" && Number.isFinite(perfMaxMs)) {
    parts.push(`max${Math.max(0, Math.round(perfMaxMs))}ms`);
  }
  if (query && query.trim()) {
    const q = sanitizeFilenameToken(query).slice(0, 24).replace(/-+$/, "");
    if (q) parts.push(`q-${q}`);
  }
  parts.push(stamp);

  const stem = parts.filter(Boolean).join("-");
  const ext = format;
  const full = `${stem}.${ext}`;

  if (full.length <= MAX_FILENAME_LEN) return full;
  // Preserve the timestamp + extension, trim the middle deterministically.
  const keepTail = `-${stamp}.${ext}`;
  const head = stem.slice(0, MAX_FILENAME_LEN - keepTail.length).replace(/-+$/, "");
  return `${head}${keepTail}`;
};
