import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2, RefreshCw, AlertTriangle, Gauge, Download } from "lucide-react";
import { PERF_BUDGETS_MS } from "@/lib/perfBudget";

// Admin performance dashboard.
// Summarises the last 24h of:
//   • Dashboard load timings (from `error_logs` perf breaches — the only place
//     we currently record dashboard load ms). We show breach count and average
//     over-budget ms.
//   • Export response times (from `export_metrics` — every export writes here).
//     We show avg + p95 encode time and success rate, plus a breach count
//     against the export_response budget.

type PerfBreach = {
  id: string;
  function_name: string;
  message: string;
  occurrence_count: number;
  last_seen_at: string;
  context: { actual_ms?: number; budget_ms?: number; request_id?: string } | null;
};

type ExportRow = {
  id: string;
  created_at: string;
  outcome: "success" | "failure" | "canceled";
  encode_time_ms: number;
  resolution: string;
  browser: string | null;
};

const SINCE_HOURS = 24;

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmtMs(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}

const AdminPerformance = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [breaches, setBreaches] = useState<PerfBreach[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - SINCE_HOURS * 3600 * 1000).toISOString();
    const [breachRes, exportRes] = await Promise.all([
      supabase
        .from("error_logs")
        .select("id,function_name,message,occurrence_count,last_seen_at,context")
        .in("function_name", ["perf:dashboard_load", "perf:export_response"])
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("export_metrics")
        .select("id,created_at,outcome,encode_time_ms,resolution,browser")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    setBreaches((breachRes.data as PerfBreach[]) ?? []);
    setExports((exportRes.data as ExportRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
     
  }, [isAdmin]);

  const dashboardStats = useMemo(() => {
    const rows = breaches.filter((b) => b.function_name === "perf:dashboard_load");
    const actuals = rows
      .map((r) => Number(r.context?.actual_ms))
      .filter((n) => Number.isFinite(n) && n > 0);
    const events = rows.reduce((s, r) => s + (r.occurrence_count ?? 1), 0);
    return {
      events,
      unique: rows.length,
      avgMs: actuals.length ? actuals.reduce((a, b) => a + b, 0) / actuals.length : 0,
      maxMs: actuals.length ? Math.max(...actuals) : 0,
      budget: PERF_BUDGETS_MS.dashboard_load,
    };
  }, [breaches]);

  const exportStats = useMemo(() => {
    const successful = exports.filter((e) => e.outcome === "success");
    const times = successful.map((e) => e.encode_time_ms).filter((n) => n > 0);
    const budget = PERF_BUDGETS_MS.export_response;
    const overBudget = times.filter((t) => t > budget).length;
    return {
      total: exports.length,
      success: successful.length,
      failure: exports.filter((e) => e.outcome === "failure").length,
      canceled: exports.filter((e) => e.outcome === "canceled").length,
      avgMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      p95Ms: percentile(times, 95),
      maxMs: times.length ? Math.max(...times) : 0,
      overBudget,
      budget,
    };
  }, [exports]);

  if (adminLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking permissions…
        </div>
      </DashboardLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Gauge className="h-6 w-6 text-primary" /> Performance
            </h1>
            <p className="text-sm text-muted-foreground">
              Dashboard load and export response times over the last {SINCE_HOURS}h.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/usage" className="text-sm text-muted-foreground hover:text-foreground">
              Usage →
            </Link>
            <Link to="/admin/errors" className="text-sm text-muted-foreground hover:text-foreground">
              Errors →
            </Link>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Activity className="h-4 w-4" />}
            label="Dashboard load breaches"
            value={String(dashboardStats.events)}
            sub={`${dashboardStats.unique} unique · budget ${fmtMs(dashboardStats.budget)}`}
            tone={dashboardStats.events > 0 ? "warn" : "ok"}
          />
          <KpiCard
            icon={<Gauge className="h-4 w-4" />}
            label="Avg dashboard load (breaches)"
            value={fmtMs(dashboardStats.avgMs)}
            sub={`worst ${fmtMs(dashboardStats.maxMs)}`}
          />
          <KpiCard
            icon={<Download className="h-4 w-4" />}
            label="Exports"
            value={String(exportStats.total)}
            sub={`${exportStats.success} ok · ${exportStats.failure} fail · ${exportStats.canceled} cancel`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Export budget exceed"
            value={String(exportStats.overBudget)}
            sub={`budget ${fmtMs(exportStats.budget)} · p95 ${fmtMs(exportStats.p95Ms)}`}
            tone={exportStats.overBudget > 0 ? "warn" : "ok"}
          />
        </section>

        {/* Detail: dashboard load */}
        <section className="rounded-xl border bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-medium">Dashboard load — budget exceed events</h2>
            <span className="text-xs text-muted-foreground">
              Budget {fmtMs(dashboardStats.budget)}
            </span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : dashboardStats.events === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No breaches in the last {SINCE_HOURS}h — everything within budget.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Last seen</th>
                  <th className="p-3">Actual</th>
                  <th className="p-3">Over budget</th>
                  <th className="p-3">Occurrences</th>
                  <th className="p-3">Request</th>
                </tr>
              </thead>
              <tbody>
                {breaches
                  .filter((b) => b.function_name === "perf:dashboard_load")
                  .map((b) => {
                    const actual = Number(b.context?.actual_ms) || 0;
                    const over = actual - dashboardStats.budget;
                    const reqId = b.context?.request_id ?? b.id;
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(b.last_seen_at).toLocaleString()}
                        </td>
                        <td className="p-3">{fmtMs(actual)}</td>
                        <td className="p-3 text-amber-500">+{fmtMs(over)}</td>
                        <td className="p-3">{b.occurrence_count}</td>
                        <td className="p-3">
                          <Link
                            to={`/dashboard/errors?request=${encodeURIComponent(reqId)}`}
                            className="font-mono text-xs text-primary hover:underline"
                            title="Open in error log"
                          >
                            {reqId.slice(0, 12)} →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </section>

        {/* Detail: export response */}
        <section className="rounded-xl border bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-medium">Export response — last {SINCE_HOURS}h</h2>
            <span className="text-xs text-muted-foreground">
              avg {fmtMs(exportStats.avgMs)} · p95 {fmtMs(exportStats.p95Ms)} · max {fmtMs(exportStats.maxMs)}
            </span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : exports.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No exports in the last {SINCE_HOURS}h.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground sticky top-0 bg-card">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Outcome</th>
                    <th className="p-3">Resolution</th>
                    <th className="p-3">Browser</th>
                    <th className="p-3">Encode time</th>
                    <th className="p-3">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.slice(0, 200).map((e) => {
                    const over = e.encode_time_ms > exportStats.budget;
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              e.outcome === "success"
                                ? "text-green-500"
                                : e.outcome === "failure"
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }
                          >
                            {e.outcome}
                          </span>
                        </td>
                        <td className="p-3">{e.resolution}</td>
                        <td className="p-3">{e.browser ?? "—"}</td>
                        <td className="p-3">{fmtMs(e.encode_time_ms)}</td>
                        <td className="p-3">
                          {over ? (
                            <span className="text-amber-500 inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> over
                            </span>
                          ) : (
                            <span className="text-muted-foreground">ok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-green-500" : ""
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default AdminPerformance;
