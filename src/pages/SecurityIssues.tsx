// Admin-only panel that surfaces persisted security scan findings and lets
// admins mark each finding as accepted or fixed with a note.
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Search,
} from "lucide-react";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type Status = "open" | "accepted" | "fixed";

interface Finding {
  id: string;
  scanner_name: string;
  external_id: string | null;
  title: string;
  summary: string;
  severity: Severity;
  status: Status;
  resource: string | null;
  notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

const SEV_COLOR: Record<Severity, string> = {
  info: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

const STATUS_COLOR: Record<Status, string> = {
  open: "bg-red-500/15 text-red-300 border-red-500/30",
  accepted: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  fixed: "bg-green-500/15 text-green-300 border-green-500/30",
};

const SecurityIssues = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("security-scan", { body: {} });
      if (error) {
        const details = (error as any)?.context?.text ? await (error as any).context.text() : (error as any).message;
        throw new Error(details || "Scan failed");
      }
      const d = data as { scanned?: number; inserted?: number; updated?: number; at?: string } | null;
      setLastScanAt(d?.at ?? new Date().toISOString());
      toast.success(`Scan complete — ${d?.scanned ?? 0} checks (${d?.inserted ?? 0} new, ${d?.updated ?? 0} updated)`);
      await load();
    } catch (e: any) {
      toast.error(`Scan failed: ${e.message ?? e}`);
    } finally {
      setScanning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("security_findings")
      .select("*")
      .order("severity", { ascending: false })
      .order("last_seen_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Finding[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        r.title.toLowerCase().includes(s) ||
        r.summary.toLowerCase().includes(s) ||
        r.scanner_name.toLowerCase().includes(s) ||
        (r.resource ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, filter, q]);

  const counts = useMemo(() => ({
    total: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    accepted: rows.filter((r) => r.status === "accepted").length,
    fixed: rows.filter((r) => r.status === "fixed").length,
    critical: rows.filter((r) => r.severity === "critical" && r.status === "open").length,
  }), [rows]);

  const decide = async (id: string, status: Status) => {
    if (!user) return;
    const notes = (noteDraft[id] ?? "").trim() || null;
    setBusy(id);
    const { error } = await (supabase as any)
      .from("security_findings")
      .update({
        status,
        notes,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "fixed" ? "Marked as fixed" : status === "accepted" ? "Marked as accepted" : "Reopened");
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, notes, decided_at: new Date().toISOString(), decided_by: user.id } : r)));
  };

  if (adminLoading) {
    return (
      <DashboardLayout>
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/50 p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Security findings are visible to workspace administrators.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Security issues</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Persisted scan findings from all connected scanners. Mark issues as accepted or fixed with notes for audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastScanAt && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Last scan: {new Date(lastScanAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={runScan}
              disabled={scanning || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              {scanning ? "Scanning…" : "Re-run scan"}
            </button>
            <button
              onClick={load}
              disabled={loading || scanning}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold hover:border-primary/50 disabled:opacity-60"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>


        {/* Summary tiles */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total", value: counts.total, icon: Shield, color: "text-foreground" },
            { label: "Critical open", value: counts.critical, icon: AlertTriangle, color: "text-red-400" },
            { label: "Open", value: counts.open, icon: AlertTriangle, color: "text-red-400" },
            { label: "Accepted", value: counts.accepted, icon: CircleSlash, color: "text-amber-400" },
            { label: "Fixed", value: counts.fixed, icon: CheckCircle2, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                {s.label}
              </div>
              <div className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["all", "open", "accepted", "fixed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-card/40 px-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, resource, scanner…"
              className="w-64 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {loading && (
            <div className="grid place-items-center rounded-xl border border-border bg-card/40 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
              No findings match this filter. When a scan runs, results will appear here.
            </div>
          )}
          {!loading && filtered.map((f) => {
            const isOpen = expanded === f.id;
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card/50">
                <button
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-card/70"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SEV_COLOR[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[f.status]}`}>
                        {f.status}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.scanner_name}
                      </span>
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.summary}</p>
                    {f.resource && (
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/80">{f.resource}</p>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Summary</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{f.summary}</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div><span className="text-foreground/80">Scanner:</span> {f.scanner_name}</div>
                        {f.external_id && <div><span className="text-foreground/80">External ID:</span> <span className="font-mono">{f.external_id}</span></div>}
                        <div><span className="text-foreground/80">First seen:</span> {new Date(f.first_seen_at).toLocaleString()}</div>
                        <div><span className="text-foreground/80">Last seen:</span> {new Date(f.last_seen_at).toLocaleString()}</div>
                        {f.decided_at && <div><span className="text-foreground/80">Decided:</span> {new Date(f.decided_at).toLocaleString()}</div>}
                      </div>
                    </div>

                    {f.notes && (
                      <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Existing note</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{f.notes}</p>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Decision note {f.status === "open" ? "" : "(updates existing)"}
                      </label>
                      <textarea
                        value={noteDraft[f.id] ?? ""}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                        placeholder="Why is this being accepted or fixed? What was changed?"
                        rows={2}
                        className="mt-1 w-full resize-y rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busy === f.id}
                        onClick={() => decide(f.id, "fixed")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 border border-green-500/40 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark fixed
                      </button>
                      <button
                        disabled={busy === f.id}
                        onClick={() => decide(f.id, "accepted")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-60"
                      >
                        <CircleSlash className="h-3.5 w-3.5" /> Accept risk
                      </button>
                      {f.status !== "open" && (
                        <button
                          disabled={busy === f.id}
                          onClick={() => decide(f.id, "open")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 disabled:opacity-60"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SecurityIssues;
