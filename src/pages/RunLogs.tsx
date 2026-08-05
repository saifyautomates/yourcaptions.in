import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Download, RefreshCw, CheckCircle2, XCircle, Loader2, AlertCircle, FileText, ExternalLink,
} from "lucide-react";

type RunKind = "transcribe" | "dub" | "translate" | "export";
type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

interface RunRow {
  id: string;
  source: "job" | "export";
  kind: RunKind;
  status: RunStatus;
  createdAt: string;
  finishedAt?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  message?: string | null;
  error?: string | null;
  raw: any;
}

const STATUS_COLORS: Record<RunStatus, string> = {
  queued:    "text-muted-foreground",
  running:   "text-sky-500",
  succeeded: "text-green-500",
  failed:    "text-red-500",
  canceled:  "text-amber-500",
};

const StatusIcon = ({ s }: { s: RunStatus }) => {
  if (s === "succeeded") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === "failed")    return <XCircle className="h-4 w-4 text-red-500" />;
  if (s === "running")   return <Loader2 className="h-4 w-4 animate-spin text-sky-500" />;
  if (s === "canceled")  return <AlertCircle className="h-4 w-4 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function durationMs(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const d = new Date(b).getTime() - new Date(a).getTime();
  return d >= 0 ? d : null;
}

function buildLogText(row: RunRow) {
  const d = row.raw ?? {};
  const lines: string[] = [];
  lines.push(`# Yourcaptions run log`);
  lines.push(`run_id     : ${row.id}`);
  lines.push(`source     : ${row.source}`);
  lines.push(`kind       : ${row.kind}`);
  lines.push(`status     : ${row.status}`);
  lines.push(`project_id : ${row.projectId ?? "-"}`);
  lines.push(`project    : ${row.projectTitle ?? "-"}`);
  lines.push(`created_at : ${row.createdAt}`);
  lines.push(`finished_at: ${row.finishedAt ?? "-"}`);
  const dur = durationMs(row.createdAt, row.finishedAt);
  if (dur != null) lines.push(`duration_ms: ${dur}`);
  lines.push("");
  if (row.message) { lines.push(`message: ${row.message}`); lines.push(""); }
  if (row.error)   { lines.push(`error:   ${row.error}`);   lines.push(""); }
  if (row.source === "job") {
    lines.push(`## job input`);
    lines.push(JSON.stringify(d.input ?? {}, null, 2));
    lines.push("");
    lines.push(`## job result`);
    lines.push(JSON.stringify(d.result ?? {}, null, 2));
    if (typeof d.progress === "number") { lines.push(""); lines.push(`progress: ${d.progress}%`); }
  } else {
    lines.push(`## export metrics`);
    const keys = [
      "outcome", "path", "browser", "resolution", "codec", "profile", "level",
      "bitrate", "fps_target", "encode_time_ms", "frames_encoded", "effective_fps",
      "realtime_multiplier", "source_duration_sec", "source_width", "source_height",
      "output_bytes", "error_category", "error_message",
    ];
    for (const k of keys) lines.push(`${k.padEnd(20)}: ${d[k] ?? "-"}`);
  }
  return lines.join("\n") + "\n";
}

function downloadLog(row: RunRow) {
  const text = buildLogText(row);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${row.source}-${row.kind}-${row.id.slice(0, 8)}.log`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function RunLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | RunKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RunStatus>("all");
  const [selected, setSelected] = useState<RunRow | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: jobs }, { data: exps }, { data: projs }] = await Promise.all([
      supabase.from("jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("export_metrics").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("projects").select("id,title").eq("user_id", user.id),
    ]);
    const titleMap = new Map<string, string>((projs ?? []).map((p: any) => [p.id, p.title]));

    const jobRows: RunRow[] = (jobs ?? []).map((j: any) => ({
      id: j.id,
      source: "job",
      kind: j.kind as RunKind,
      status: j.status as RunStatus,
      createdAt: j.created_at,
      finishedAt: j.finished_at ?? j.updated_at,
      projectId: j.project_id,
      projectTitle: j.project_id ? titleMap.get(j.project_id) ?? null : null,
      message: j.message,
      error: j.error,
      raw: j,
    }));

    const expRows: RunRow[] = (exps ?? []).map((e: any) => ({
      id: e.id,
      source: "export",
      kind: "export",
      status: (e.outcome === "success" ? "succeeded" : e.outcome === "canceled" ? "canceled" : "failed") as RunStatus,
      createdAt: e.created_at,
      finishedAt: e.created_at,
      projectId: null,
      projectTitle: null,
      message: `${e.resolution} · ${e.codec} · ${e.effective_fps ?? "-"}fps`,
      error: e.error_message,
      raw: e,
    }));

    const merged = [...jobRows, ...expRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setRows(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [user?.id, load]);

  const filtered = useMemo(() => rows.filter(r =>
    (kindFilter === "all" || r.kind === kindFilter) &&
    (statusFilter === "all" || r.status === statusFilter)
  ), [rows, kindFilter, statusFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    failed: rows.filter(r => r.status === "failed").length,
    succeeded: rows.filter(r => r.status === "succeeded").length,
    running: rows.filter(r => r.status === "running" || r.status === "queued").length,
  }), [rows]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="ml-2 text-2xl font-semibold">Run logs</h1>
          <button
            onClick={load}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3 text-xs">
          <div><div className="text-muted-foreground">Total</div><div className="text-lg font-semibold">{counts.total}</div></div>
          <div><div className="text-muted-foreground">Succeeded</div><div className="text-lg font-semibold text-green-500">{counts.succeeded}</div></div>
          <div><div className="text-muted-foreground">Failed</div><div className="text-lg font-semibold text-red-500">{counts.failed}</div></div>
          <div><div className="text-muted-foreground">In flight</div><div className="text-lg font-semibold text-sky-500">{counts.running}</div></div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="rounded-md border border-border bg-input/40 px-2 py-1.5"
          >
            <option value="all">All kinds</option>
            <option value="transcribe">Transcribe</option>
            <option value="translate">Translate</option>
            <option value="dub">Dub</option>
            <option value="export">Export</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-md border border-border bg-input/40 px-2 py-1.5"
          >
            <option value="all">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Kind</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Project</th>
                <th className="px-3 py-2 text-left font-medium">Started</th>
                <th className="px-3 py-2 text-left font-medium">Duration</th>
                <th className="px-3 py-2 text-left font-medium">Message</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No runs match these filters.</td></tr>
              )}
              {filtered.map((r) => {
                const dur = durationMs(r.createdAt, r.finishedAt);
                return (
                  <tr key={`${r.source}:${r.id}`} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium capitalize">{r.kind}</td>
                    <td className={`px-3 py-2 ${STATUS_COLORS[r.status]}`}>
                      <span className="inline-flex items-center gap-1.5"><StatusIcon s={r.status} />{r.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.projectId ? (
                        <Link to={`/dashboard/project/${r.projectId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          {r.projectTitle ?? r.projectId.slice(0, 8)} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmt(r.createdAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dur == null ? "—" : `${(dur / 1000).toFixed(1)}s`}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate text-muted-foreground" title={r.error || r.message || ""}>
                      {r.error || r.message || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setSelected(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
                        >
                          <FileText className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={() => downloadLog(r)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <Download className="h-3 w-3" /> Log
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <StatusIcon s={selected.status} />
              <div>
                <div className="text-sm font-semibold capitalize">{selected.kind} · {selected.status}</div>
                <div className="text-[11px] text-muted-foreground">{fmt(selected.createdAt)} · id {selected.id.slice(0, 8)}</div>
              </div>
              <button
                onClick={() => downloadLog(selected)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Download log
              </button>
              <button onClick={() => setSelected(null)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Close</button>
            </div>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed">
              {buildLogText(selected)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
