import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, Bug, CheckCircle2, Copy, Download, ExternalLink, Gauge, Loader2, RefreshCw, Search, Shield } from "lucide-react";
import { buildExportBlob, buildExportFilename, filterBySearch, streamExportToWritable } from "@/lib/errorLogExport";
import { PERF_BUDGETS_MS, PERF_LABELS, type PerfKey } from "@/lib/perfBudget";
import { Link } from "react-router-dom";

// Parse a perf-breach error_logs row into normalised numbers + a link target.
// Returns null when the row is not a perf entry.
function parsePerfRow(r: { function_name: string | null; context: Record<string, unknown> }) {
  const fn = r.function_name ?? "";
  if (!fn.startsWith("perf:")) return null;
  const key = fn.slice("perf:".length) as PerfKey;
  const label = PERF_LABELS[key] ?? key;
  const ctx = r.context ?? {};
  const actualMs = Number((ctx as any).actual_ms) || 0;
  const budgetMs = Number((ctx as any).budget_ms) || PERF_BUDGETS_MS[key] || 0;
  const requestId = typeof (ctx as any).request_id === "string" ? (ctx as any).request_id : null;
  const overMs = Math.max(0, actualMs - budgetMs);
  const overPct = budgetMs > 0 ? Math.round((overMs / budgetMs) * 100) : 0;
  return { key, label, actualMs, budgetMs, overMs, overPct, requestId };
}

function fmtMs(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`;
}

type Severity = "info" | "warning" | "error" | "critical";
type Source = "frontend" | "edge_function" | "database" | "external";

interface ErrorRow {
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

const severityStyle: Record<Severity, string> = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  error: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  critical: "bg-red-500/10 text-red-500 border-red-500/30",
};

const ranges = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "All", ms: 0 },
];

const ErrorLogs = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeMs, setRangeMs] = useState(24 * 60 * 60 * 1000);
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [source, setSource] = useState<"all" | Source>("all");
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [query, setQuery] = useState("");
  const [authOnly, setAuthOnly] = useState(false);
  const [perfOnly, setPerfOnly] = useState(false);
  const [perfKey, setPerfKey] = useState<"all" | PerfKey>("all");
  const [perfMinMs, setPerfMinMs] = useState<string>("");
  const [perfMaxMs, setPerfMaxMs] = useState<string>("");
  const [selected, setSelected] = useState<ErrorRow | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkRequestId = searchParams.get("request");
  // When deep-linked with ?request=<id>, widen status so a resolved row is
  // still reachable — otherwise the default "open" filter can hide it.
  useEffect(() => {
    if (deepLinkRequestId) setStatus("all");
     
  }, [deepLinkRequestId]);
  // Auto-open the matching row's detail modal once rows have loaded.
  const deepLinkConsumedRef = useRef(false);
  useEffect(() => {
    if (!deepLinkRequestId || deepLinkConsumedRef.current || rows.length === 0) return;
    const hit = rows.find((r) => {
      if (r.id === deepLinkRequestId) return true;
      const p = parsePerfRow(r);
      return p?.requestId === deepLinkRequestId;
    });
    if (hit) {
      setSelected(hit);
      deepLinkConsumedRef.current = true;
      // Clear the param so refresh/back doesn't re-open unexpectedly.
      const next = new URLSearchParams(searchParams);
      next.delete("request");
      setSearchParams(next, { replace: true });
    } else if (!loading) {
      toast.info(`No error log found for request ${deepLinkRequestId.slice(0, 12)}…`);
      deepLinkConsumedRef.current = true;
    }
  }, [deepLinkRequestId, rows, loading, searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("error_logs").select("*").order("last_seen_at", { ascending: false }).limit(500);
    if (rangeMs > 0) q = q.gte("last_seen_at", new Date(Date.now() - rangeMs).toISOString());
    if (severity !== "all") q = q.eq("severity", severity);
    if (source !== "all") q = q.eq("source", source);
    if (status !== "all") q = q.eq("resolved", status === "resolved");
    if (authOnly) q = q.eq("function_name", "auth");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as ErrorRow[]);
    setLoading(false);
  }, [rangeMs, severity, source, status, authOnly]);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, rangeMs, severity, source, status, authOnly, load]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase.channel(`error-logs-stream-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "error_logs" }, () => void load())
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch { /* noop */ }
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const perfRange = useMemo(() => {
    const parse = (v: string): { value: number | null; error: string | null } => {
      if (v.trim() === "") return { value: null, error: null };
      const n = Number(v);
      if (!Number.isFinite(n)) return { value: null, error: "Not a number" };
      if (n < 0) return { value: null, error: "Must be ≥ 0" };
      if (n > 3_600_000) return { value: null, error: "Max 3,600,000 ms" };
      return { value: n, error: null };
    };
    const minP = parse(perfMinMs);
    const maxP = parse(perfMaxMs);
    let rangeError: string | null = null;
    if (minP.value != null && maxP.value != null && minP.value > maxP.value) {
      rangeError = "Min is greater than Max";
    }
    const valid = !minP.error && !maxP.error && !rangeError;
    return { minP, maxP, rangeError, valid };
  }, [perfMinMs, perfMaxMs]);

  const filtered = useMemo(() => {
    const base = filterBySearch(rows, query);
    const { minP, maxP, valid } = perfRange;
    const hasRange = minP.value != null || maxP.value != null;
    if (!perfOnly && perfKey === "all" && !hasRange) return base;
    const min = valid && minP.value != null ? minP.value : -Infinity;
    const max = valid && maxP.value != null ? maxP.value : Infinity;
    return base.filter((r) => {
      const perf = parsePerfRow(r);
      if (perfOnly && !perf) return false;
      if (!perf) return true; // perfKey/min/max only apply to perf rows when perfOnly is off
      if (perfKey !== "all" && perf.key !== perfKey) return false;
      if (perf.actualMs < min || perf.actualMs > max) return false;
      return true;
    });
  }, [rows, query, perfOnly, perfKey, perfRange]);

  const stats = useMemo(() => {
    const acc = { total: 0, open: 0, critical: 0, occurrences: 0 };
    for (const r of rows) {
      acc.total++;
      if (!r.resolved) acc.open++;
      if (r.severity === "critical") acc.critical++;
      acc.occurrences += r.occurrence_count;
    }
    return acc;
  }, [rows]);

  const setResolved = async (id: string, resolved: boolean) => {
    const prev = rows;
    setRows((r) => r.map((x) => x.id === id ? { ...x, resolved, resolved_at: resolved ? new Date().toISOString() : null } : x));
    if (selected?.id === id) setSelected({ ...selected, resolved });
    const { error } = await supabase.from("error_logs")
      .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(error.message);
    } else {
      toast.success(resolved ? "Marked resolved" : "Reopened");
    }
  };

  // Export the currently filtered rows (respecting range, severity, source,
  // status, Auth-only toggle, and the search query) as CSV or JSON. Runs
  // fully client-side against the already-loaded `filtered` array so what
  // you see is exactly what you get in the file.
  const [exporting, setExporting] = useState<null | "csv" | "json">(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const exportRows = async (format: "csv" | "json") => {
    if (filtered.length === 0) {
      toast.info("Nothing to export for the current filters.");
      return;
    }
    if (exporting) {
      toast.info("An export is already in progress.");
      return;
    }
    const total = filtered.length;
    const filenameArgs = {
      format, status, authOnly, severity, source,
      rangeMs, query,
      perfOnly, perfKey,
      perfMinMs: perfRange.valid ? perfRange.minP.value : null,
      perfMaxMs: perfRange.valid ? perfRange.maxP.value : null,
    } as const;
    const filename = buildExportFilename(filenameArgs);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExporting(format);

    const toastId = toast.loading(`Preparing ${format.toUpperCase()} export (0 / ${total.toLocaleString()})…`, {
      duration: Infinity,
      action: {
        label: "Cancel",
        onClick: () => controller.abort(),
      },
    });
    const t0 = performance.now();
    let lastUpdate = 0;
    try {
      const enrich = (r: typeof filtered[number]) => {
        const p = parsePerfRow(r);
        if (!p) return null;
        return {
          perf_metric: p.key,
          perf_metric_label: p.label,
          perf_measured_ms: p.actualMs,
          perf_threshold_ms: p.budgetMs,
          perf_over_ms: p.overMs,
          perf_over_pct: p.overPct,
          request_id: p.requestId ?? r.id,
        };
      };
      const extraColumns = [
        "perf_metric", "perf_metric_label",
        "perf_measured_ms", "perf_threshold_ms",
        "perf_over_ms", "perf_over_pct", "request_id",
      ];
      const onProgress = (frac: number, done: number) => {
        const now = performance.now();
        if (now - lastUpdate < 120 && done < total) return;
        lastUpdate = now;
        toast.loading(
          `Preparing ${format.toUpperCase()} export (${done.toLocaleString()} / ${total.toLocaleString()} • ${Math.round(frac * 100)}%)`,
          { id: toastId, duration: Infinity },
        );
      };
      const streamOpts = { signal: controller.signal, enrich, extraColumns, onProgress };

      // Prefer true streaming to disk when the File System Access API is
      // available — peak memory stays flat regardless of export size.
      const w = window as any;
      let bytesWritten = 0;
      let usedStreaming = false;
      if (typeof w.showSaveFilePicker === "function" && total >= 5000) {
        try {
          const handle = await w.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: format === "json" ? "JSON file" : "CSV file",
              accept: format === "json" ? { "application/json": [".json"] } : { "text/csv": [".csv"] },
            }],
          });
          const writable = await handle.createWritable();
          const enc = new TextEncoder();
          const wrapped = {
            write: async (data: BufferSource | Blob | string) => {
              if (typeof data === "string") { const b = enc.encode(data); bytesWritten += b.byteLength; await writable.write(b); }
              else if (data instanceof Blob) { bytesWritten += data.size; await writable.write(data); }
              else { bytesWritten += (data as ArrayBufferView).byteLength; await writable.write(data); }
            },
            close: () => writable.close(),
            abort: (reason?: unknown) => writable.abort?.(reason),
          };
          await streamExportToWritable(filtered, format, wrapped, streamOpts);
          usedStreaming = true;
        } catch (pickerErr) {
          if ((pickerErr as any)?.name === "AbortError") throw pickerErr;
          // Picker unsupported or user denied — fall through to Blob path.
          usedStreaming = false;
        }
      }

      let sizeBytes = bytesWritten;
      if (!usedStreaming) {
        const blob = await buildExportBlob(filtered, format, streamOpts);
        sizeBytes = blob.size;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      const sizeMb = sizeBytes / (1024 * 1024);
      const sizeLabel = sizeMb >= 1 ? `${sizeMb.toFixed(1)} MB` : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
      const ms = Math.round(performance.now() - t0);
      toast.success(
        `Exported ${total.toLocaleString()} ${total === 1 ? "row" : "rows"} → ${filename}`,
        { id: toastId, description: `${sizeLabel} • ${ms} ms${usedStreaming ? " • streamed" : ""}`, duration: 6000 },
      );
    } catch (err) {
      if ((err as any)?.name === "AbortError") {
        toast.warning("Export cancelled", { id: toastId, description: filename, duration: 4000 });
      } else {
        console.error("[ErrorLogs] export failed", err);
        toast.error("Export failed", {
          id: toastId,
          description: err instanceof Error ? err.message : "Unknown error while building the file.",
          duration: 8000,
        });
      }
    } finally {
      exportAbortRef.current = null;
      setExporting(null);
    }
  };



  if (adminLoading) {
    return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Shield className="h-6 w-6 text-primary" /> Error Monitoring
            </h1>
            <p className="text-sm text-muted-foreground">Live-streamed frontend and backend errors, deduped by fingerprint.</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="hidden md:flex flex-col items-end text-right leading-tight"
              title={filtered.length === 0 ? "Nothing to export for the current filters" : "Filename preview — updates with your filters"}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Will download</span>
              <span className="font-mono text-xs text-foreground/80 max-w-[280px] truncate">
                {filtered.length === 0 ? "—" : buildExportFilename({ format: "csv", status, authOnly, severity, source, rangeMs, query, perfOnly, perfKey, perfMinMs: perfRange.valid ? perfRange.minP.value : null, perfMaxMs: perfRange.valid ? perfRange.maxP.value : null }).replace(/\.csv$/, ".{csv,json}")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {filtered.length.toLocaleString()} {filtered.length === 1 ? "row" : "rows"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void exportRows("csv")} disabled={loading || filtered.length === 0 || exporting !== null} aria-busy={exporting === "csv"}
              title={filtered.length === 0 ? "Nothing to export" : `Downloads ${buildExportFilename({ format: "csv", status, authOnly, severity, source, rangeMs, query, perfOnly, perfKey, perfMinMs: perfRange.valid ? perfRange.minP.value : null, perfMaxMs: perfRange.valid ? perfRange.maxP.value : null })}`}>
              {exporting === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting === "csv" ? "Exporting…" : "CSV"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportRows("json")} disabled={loading || filtered.length === 0 || exporting !== null} aria-busy={exporting === "json"}
              title={filtered.length === 0 ? "Nothing to export" : `Downloads ${buildExportFilename({ format: "json", status, authOnly, severity, source, rangeMs, query, perfOnly, perfKey, perfMinMs: perfRange.valid ? perfRange.minP.value : null, perfMaxMs: perfRange.valid ? perfRange.maxP.value : null })}`}>
              {exporting === "json" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting === "json" ? "Exporting…" : "JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Unique errors" value={stats.total} icon={<Bug className="h-4 w-4" />} />
          <StatCard label="Open" value={stats.open} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} />
          <StatCard label="Critical" value={stats.critical} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
          <StatCard label="Total occurrences" value={stats.occurrences} icon={<Bug className="h-4 w-4" />} />
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              {ranges.map((r) => (
                <button key={r.label} onClick={() => setRangeMs(r.ms)}
                  className={`px-3 py-1.5 text-xs ${rangeMs === r.ms ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="rounded-md border bg-background px-2 py-1.5 text-xs">
              <option value="all">All severities</option><option value="info">Info</option>
              <option value="warning">Warning</option><option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}
              className="rounded-md border bg-background px-2 py-1.5 text-xs">
              <option value="all">All sources</option><option value="frontend">Frontend</option>
              <option value="edge_function">Edge function</option><option value="database">Database</option>
              <option value="external">External</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-md border bg-background px-2 py-1.5 text-xs">
              <option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={() => setAuthOnly((v) => !v)}
              className={`rounded-md border px-2 py-1.5 text-xs ${authOnly ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
              title="Show only auth (sign-in / sign-up / OAuth) failures"
            >
              Auth only
            </button>
            <button
              type="button"
              onClick={() => setPerfOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${perfOnly ? "border-amber-500/60 bg-amber-500/10 text-amber-500" : "hover:bg-muted"}`}
              title="Show only perf-budget-exceeded logs"
            >
              <Gauge className="h-3 w-3" /> Perf only
            </button>
            <select
              value={perfKey}
              onChange={(e) => setPerfKey(e.target.value as typeof perfKey)}
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
              title="Filter by threshold type"
              disabled={!perfOnly && perfKey === "all" && !perfMinMs && !perfMaxMs ? false : false}
            >
              <option value="all">All thresholds</option>
              {(Object.keys(PERF_LABELS) as PerfKey[]).map((k) => (
                <option key={k} value={k}>{PERF_LABELS[k]} ({PERF_BUDGETS_MS[k]}ms)</option>
              ))}
            </select>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={perfMinMs}
                  onChange={(e) => setPerfMinMs(e.target.value)}
                  placeholder="min ms"
                  className={`h-8 w-24 text-xs ${perfRange.minP.error || perfRange.rangeError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  aria-label="Minimum measured duration in ms"
                  aria-invalid={!!(perfRange.minP.error || perfRange.rangeError)}
                  aria-describedby="perf-range-error"
                />
                <button
                  type="button"
                  className="rounded-md border px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => { const a = perfMinMs; setPerfMinMs(perfMaxMs); setPerfMaxMs(a); }}
                  disabled={!perfMinMs && !perfMaxMs}
                  title="Swap min and max"
                  aria-label="Swap min and max"
                >
                  ⇄
                </button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={perfMaxMs}
                  onChange={(e) => setPerfMaxMs(e.target.value)}
                  placeholder="max ms"
                  className={`h-8 w-24 text-xs ${perfRange.maxP.error || perfRange.rangeError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  aria-label="Maximum measured duration in ms"
                  aria-invalid={!!(perfRange.maxP.error || perfRange.rangeError)}
                  aria-describedby="perf-range-error"
                />
                {(perfMinMs || perfMaxMs || perfKey !== "all" || perfOnly) && (
                  <button
                    type="button"
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    onClick={() => { setPerfOnly(false); setPerfKey("all"); setPerfMinMs(""); setPerfMaxMs(""); }}
                    title="Clear perf filters"
                  >
                    Clear
                  </button>
                )}
              </div>
              {(perfRange.minP.error || perfRange.maxP.error || perfRange.rangeError) && (
                <p id="perf-range-error" role="alert" className="text-[11px] text-destructive">
                  {perfRange.minP.error && <span>Min: {perfRange.minP.error}. </span>}
                  {perfRange.maxP.error && <span>Max: {perfRange.maxP.error}. </span>}
                  {perfRange.rangeError && <span>{perfRange.rangeError} — click ⇄ to swap.</span>}
                </p>
              )}
            </div>
            <div className="relative ml-auto min-w-[220px] flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search message / URL / stack" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              No errors match these filters. Nice.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const perf = parsePerfRow(r);
                return (
                <button key={r.id} onClick={() => setSelected(r)}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50">
                  <Badge variant="outline" className={severityStyle[r.severity]}>{r.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-sm font-medium">{r.message}</span>
                      {perf && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 gap-1">
                          <Gauge className="h-3 w-3" />
                          {fmtMs(perf.actualMs)} / {fmtMs(perf.budgetMs)}
                          {perf.overPct > 0 && <span className="opacity-80">(+{perf.overPct}%)</span>}
                        </Badge>
                      )}
                      {r.resolved && <Badge variant="outline" className="bg-green-500/10 text-green-600">resolved</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.source}{r.function_name ? ` · ${r.function_name}` : ""}</span>
                      <span>· {r.occurrence_count}× occurrences</span>
                      <span>· last {new Date(r.last_seen_at).toLocaleString()}</span>
                      {perf?.requestId && <span>· req <span className="font-mono">{perf.requestId}</span></span>}
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <Card className="max-h-[85vh] w-full max-w-3xl overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityStyle[selected.severity]}>{selected.severity}</Badge>
                  <Badge variant="outline">{selected.source}</Badge>
                  {selected.function_name && <Badge variant="outline">{selected.function_name}</Badge>}
                  {selected.resolved && <Badge variant="outline" className="bg-green-500/10 text-green-600">resolved</Badge>}
                </div>
                <h3 className="break-words text-lg font-semibold">{selected.message}</h3>
              </div>
              <Button size="sm" variant={selected.resolved ? "outline" : "default"}
                onClick={() => void setResolved(selected.id, !selected.resolved)}>
                {selected.resolved ? "Reopen" : "Mark resolved"}
              </Button>
            </div>
            {(() => {
              const perf = parsePerfRow(selected);
              if (!perf) return null;
              return (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-500">
                    <Gauge className="h-4 w-4" /> {perf.label} — budget exceeded
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                    <Meta label="Measured" value={fmtMs(perf.actualMs)} />
                    <Meta label="Threshold" value={fmtMs(perf.budgetMs)} />
                    <Meta label="Over budget" value={`+${fmtMs(perf.overMs)}${perf.overPct ? ` (+${perf.overPct}%)` : ""}`} />
                    <Meta label="Metric" value={perf.key} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Request ID</span>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      {perf.requestId ?? selected.id}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(perf.requestId ?? selected.id);
                        toast.success("Request ID copied");
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                    <Link
                      to={`/admin/performance?request=${encodeURIComponent(perf.requestId ?? selected.id)}&metric=${perf.key}`}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      View in Performance <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })()}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <Meta label="First seen" value={new Date(selected.first_seen_at).toLocaleString()} />
              <Meta label="Last seen" value={new Date(selected.last_seen_at).toLocaleString()} />
              <Meta label="Occurrences" value={selected.occurrence_count.toString()} />
              <Meta label="Fingerprint" value={selected.fingerprint.slice(0, 12)} />
              {selected.url && <Meta label="URL" value={selected.url} full />}
              {selected.user_id && <Meta label="User" value={selected.user_id} />}
              {selected.user_agent && <Meta label="User agent" value={selected.user_agent} full />}
            </div>
            {selected.stack && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Stack trace</div>
                <pre className="max-h-72 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed">{selected.stack}</pre>
              </div>
            )}
            {Object.keys(selected.context ?? {}).length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Context</div>
                <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-[11px]">{JSON.stringify(selected.context, null, 2)}</pre>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <Card className="flex items-center gap-3 p-4">
    <div className="rounded-md bg-muted p-2">{icon}</div>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  </Card>
);

const Meta = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <div className={full ? "col-span-2" : ""}>
    <div className="text-muted-foreground">{label}</div>
    <div className="break-all font-mono">{value}</div>
  </div>
);

export default ErrorLogs;
