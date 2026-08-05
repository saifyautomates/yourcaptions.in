import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Search, Shield, Activity, Loader2, RefreshCw, Gift, X, UserPlus, ShieldCheck, ShieldOff, BarChart3, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ProviderUsageDashboard } from "@/components/admin/ProviderUsageDashboard";


type Row = {
  user_id: string;
  full_name: string | null;
  plan: string;
  credits_seconds: number;
  transcribe_count: number;
  dub_count: number;
  translate_count: number;
  total_events: number;
  caption_seconds_used: number;
  dub_seconds_used: number;
  export_count_used: number;
  is_admin?: boolean;
  email?: string | null;
};

const OWNER_ID = "64f73634-1f54-4cd6-83f4-b57d709747c5";

type Event = {
  id: string;
  user_id: string;
  function_name: string;
  cost_units: number | null;
  created_at: string;
};

const ranges = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
  { label: "90d", hours: 24 * 90 },
];

const fnFilters = ["all", "transcribe", "dub-video", "translate-captions"] as const;
type FnFilter = (typeof fnFilters)[number];

const fmtMin = (s: number) => {
  const sec = Number(s) || 0;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

type UserProject = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

const fmtLastUsed = (iso?: string | null) => {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const AdminUsage = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeH, setRangeH] = useState(24 * 30);
  const [fnFilter, setFnFilter] = useState<FnFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<UserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [grantFor, setGrantFor] = useState<Row | null>(null);
  const [lastUsedByUser, setLastUsedByUser] = useState<Map<string, string>>(new Map());


  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - rangeH * 3600 * 1000).toISOString();
    const [{ data: summary }, { data: adminList }, evQuery, { data: lastEv }] = await Promise.all([
      supabase.rpc("admin_usage_summary", { _since: since }),
      supabase.rpc("admin_list_users"),
      (async () => {
        let q = supabase
          .from("usage_events")
          .select("id,user_id,function_name,cost_units,created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500);
        if (fnFilter !== "all") q = q.eq("function_name", fnFilter);
        return q;
      })(),
      supabase
        .from("usage_events")
        .select("user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);
    const lastMap = new Map<string, string>();
    for (const e of (lastEv as { user_id: string; created_at: string }[] | null) ?? []) {
      if (!lastMap.has(e.user_id)) lastMap.set(e.user_id, e.created_at);
    }
    setLastUsedByUser(lastMap);

    const adminMap = new Map<string, { is_admin: boolean; email: string | null }>(
      ((adminList as any[]) ?? []).map((u) => [u.user_id, { is_admin: !!u.is_admin, email: u.email }]),
    );
    const merged = ((summary as Row[]) ?? []).map((r) => ({
      ...r,
      is_admin: adminMap.get(r.user_id)?.is_admin ?? false,
      email: adminMap.get(r.user_id)?.email ?? null,
    }));
    setRows(merged);
    setEvents((evQuery.data as Event[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, rangeH, fnFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = rows;
    if (q)
      r = r.filter(
        (x) =>
          (x.full_name ?? "").toLowerCase().includes(q) ||
          (x.email ?? "").toLowerCase().includes(q) ||
          x.user_id.includes(q),
      );
    return r;
  }, [rows, query]);

  const toggleAdmin = async (r: Row) => {
    if (r.user_id === OWNER_ID) {
      toast.error("Owner admin cannot be changed");
      return;
    }
    const grant = !r.is_admin;
    const label = grant ? "Grant admin" : "Revoke admin";
    if (!confirm(`${label} for ${r.full_name ?? r.email ?? r.user_id.slice(0, 8)}?`)) return;
    const { error } = await supabase.rpc("admin_set_role", {
      _user_id: r.user_id,
      _email: null,
      _role: "admin",
      _grant: grant,
    });
    if (error) return toast.error(error.message);
    toast.success(grant ? "Admin granted" : "Admin revoked");
    load();
  };

  const totals = useMemo(() => {
    return filtered.reduce(
      (a, r) => ({
        transcribe: a.transcribe + Number(r.transcribe_count),
        dub: a.dub + Number(r.dub_count),
        translate: a.translate + Number(r.translate_count),
        events: a.events + Number(r.total_events),
      }),
      { transcribe: 0, dub: 0, translate: 0, events: 0 },
    );
  }, [filtered]);

  const selectedEvents = useMemo(
    () => (selected ? events.filter((e) => e.user_id === selected) : events),
    [events, selected],
  );

  // Feature-usage breakdown for the currently selected user (aggregated
  // client-side from events already loaded — no extra RPC needed).
  const featureBreakdown = useMemo(() => {
    if (!selected) return [] as { fn: string; count: number }[];
    const map = new Map<string, number>();
    for (const e of selectedEvents) {
      map.set(e.function_name, (map.get(e.function_name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([fn, count]) => ({ fn, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedEvents, selected]);

  const featureMax = featureBreakdown[0]?.count ?? 0;

  // Load the selected user's recent projects so admins can see *what*
  // (which videos/titles) they are actually working on.
  useEffect(() => {
    if (!selected) { setSelectedProjects([]); return; }
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      // We reuse admin_list_projects and filter client-side by user_id.
      // Search by the user's email narrows results server-side when known.
      const target = rows.find((r) => r.user_id === selected);
      const { data, error } = await supabase.rpc("admin_list_projects", {
        _limit: 200,
        _offset: 0,
        _status: null,
        _search: target?.email ?? null,
      });
      if (cancelled) return;
      if (error) {
        setSelectedProjects([]);
      } else {
        const list = ((data as any[]) ?? [])
          .filter((p) => p.user_id === selected)
          .slice(0, 15)
          .map((p) => ({ id: p.id, title: p.title, status: p.status, created_at: p.created_at }));
        setSelectedProjects(list);
      }
      setProjectsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selected, rows]);


  if (adminLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking permissions…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Admin · Usage</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border">
              {ranges.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRangeH(r.hours)}
                  className={`px-3 py-1.5 text-xs ${
                    rangeH === r.hours ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </header>

        <ProviderUsageDashboard />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { l: "Transcribe", v: totals.transcribe },
            { l: "Dub video", v: totals.dub },
            { l: "Translate", v: totals.translate },
            { l: "Total events", v: totals.events },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.l}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{k.v}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or user id"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <InviteAdminByEmail onDone={load} />
          <div className="flex overflow-hidden rounded-lg border border-border text-xs">
            {fnFilters.map((f) => (
              <button
                key={f}
                onClick={() => setFnFilter(f)}
                className={`px-3 py-1.5 ${fnFilter === f ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            Per-user usage {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Plan</th>
                  <th className="px-4 py-2 text-right font-medium">Credits left (s)</th>
                  <th className="px-4 py-2 text-right font-medium">Total credits used</th>
                  <th className="px-4 py-2 text-right font-medium">Total minutes used</th>
                  <th className="px-4 py-2 text-left font-medium">Credit breakdown</th>
                  <th className="px-4 py-2 text-right font-medium">Last used</th>

                  <th className="px-4 py-2 text-right font-medium">Transcribe</th>
                  <th className="px-4 py-2 text-right font-medium">Dub</th>
                  <th className="px-4 py-2 text-right font-medium">Translate</th>
                  <th className="px-4 py-2 text-right font-medium">Caption s (mo)</th>
                  <th className="px-4 py-2 text-right font-medium">Dub s (mo)</th>
                  <th className="px-4 py-2 text-right font-medium">Exports (mo)</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-muted-foreground">

                      No users match.
                    </td>
                  </tr>
                )}

                {filtered.map((r) => (
                  <tr
                    key={r.user_id}
                    onClick={() => setSelected(selected === r.user_id ? null : r.user_id)}
                    className={`cursor-pointer border-t border-border transition-colors ${
                      selected === r.user_id ? "bg-primary/5" : "hover:bg-secondary/40"
                    }`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{r.full_name ?? "—"}</span>
                        {r.is_admin && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            <ShieldCheck className="h-2.5 w-2.5" /> ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{r.email ?? "—"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.user_id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-xs capitalize">{r.plan}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.credits_seconds}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {(r.caption_seconds_used ?? 0) + (r.dub_seconds_used ?? 0)}
                      <div className="text-[10px] text-muted-foreground">seconds</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMin((r.caption_seconds_used ?? 0) + (r.dub_seconds_used ?? 0))}
                    </td>
                    <td className="px-4 py-2 min-w-[180px]">
                      {(() => {
                        const cap = r.caption_seconds_used ?? 0;
                        const dub = r.dub_seconds_used ?? 0;
                        const total = cap + dub;
                        if (total === 0) {
                          return <span className="text-[11px] text-muted-foreground">no usage</span>;
                        }
                        const capPct = Math.round((cap / total) * 100);
                        const dubPct = 100 - capPct;
                        return (
                          <div className="space-y-1">
                            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                              {cap > 0 && (
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${capPct}%` }}
                                  title={`Captions: ${cap}s (${capPct}%)`}
                                />
                              )}
                              {dub > 0 && (
                                <div
                                  className="h-full bg-blue-500"
                                  style={{ width: `${dubPct}%` }}
                                  title={`Dub: ${dub}s (${dubPct}%)`}
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                Cap {fmtMin(cap)} · {capPct}%
                              </span>
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                Dub {fmtMin(dub)} · {dubPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">
                      {fmtLastUsed(lastUsedByUser.get(r.user_id))}
                    </td>


                    <td className="px-4 py-2 text-right tabular-nums">{r.transcribe_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.dub_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.translate_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.caption_seconds_used}
                      <div className="text-[10px] text-muted-foreground">{fmtMin(r.caption_seconds_used)}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.dub_seconds_used}
                      <div className="text-[10px] text-muted-foreground">{fmtMin(r.dub_seconds_used)}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.export_count_used}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setGrantFor(r); }}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          <Gift className="h-3 w-3" /> Grant
                        </button>
                        {r.user_id !== OWNER_ID && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAdmin(r); }}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                              r.is_admin
                                ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "border-border hover:bg-secondary"
                            }`}
                            title={r.is_admin ? "Revoke admin" : "Make admin"}
                          >
                            {r.is_admin ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                            {r.is_admin ? "Revoke" : "Admin"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-user drilldown: what features + which projects they're using */}
        {selected && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Feature breakdown */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Features used by this user
                </span>
                <span className="text-[11px]">{featureBreakdown.length} distinct</span>
              </div>
              <div className="max-h-[320px] space-y-1.5 overflow-y-auto p-3">
                {featureBreakdown.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">No feature usage in this range.</p>
                ) : (
                  featureBreakdown.map((f) => {
                    const pct = featureMax > 0 ? Math.round((f.count / featureMax) * 100) : 0;
                    return (
                      <div key={f.fn} className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium">{f.fn}</span>
                          <span className="tabular-nums text-muted-foreground">{f.count}</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${f.fn} usage`}
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary"
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent projects */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Recent projects
                  {projectsLoading && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
                </span>
                <span className="text-[11px]">{selectedProjects.length}</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {selectedProjects.length === 0 && !projectsLoading ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">No projects for this user.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {selectedProjects.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                        <Link
                          to={`/dashboard/project/${p.id}`}
                          className="min-w-0 flex-1 truncate font-medium hover:text-primary hover:underline"
                          title={p.title}
                        >
                          {p.title}
                        </Link>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                            p.status === "ready"
                              ? "bg-primary/15 text-primary"
                              : p.status === "failed"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {p.status}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Events */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {selected ? "Events for selected user" : "Recent events (all users)"} · showing {selectedEvents.length}
            </span>
            {selected && (
              <button onClick={() => setSelected(null)} className="text-xs hover:text-foreground">
                Clear filter
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/80 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Function</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {selectedEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No events in this range.
                    </td>
                  </tr>
                )}
                {selectedEvents.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px]">{e.user_id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs">{e.function_name}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{e.cost_units ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {grantFor && (
        <GrantAccessModal
          row={grantFor}
          onClose={() => setGrantFor(null)}
          onDone={() => { setGrantFor(null); load(); }}
        />
      )}
    </DashboardLayout>
  );
};

type GrantModalProps = {
  row: Row;
  onClose: () => void;
  onDone: () => void;
};

const GrantAccessModal = ({ row, onClose, onDone }: GrantModalProps) => {
  const [plan, setPlan] = useState<string>(row.plan);
  const [amount, setAmount] = useState<string>("3600");
  const [mode, setMode] = useState<"add" | "set">("add");
  const [saving, setSaving] = useState(false);

  const presets = [
    { label: "+30 min", secs: 1800 },
    { label: "+1 hour", secs: 3600 },
    { label: "+5 hours", secs: 18000 },
    { label: "+30 hours", secs: 108000 },
  ];

  const submit = async () => {
    setSaving(true);
    try {
      const credits = amount.trim() === "" ? null : Math.max(0, Math.floor(Number(amount)));
      if (credits !== null && !Number.isFinite(credits)) {
        toast.error("Enter a valid number of seconds");
        setSaving(false);
        return;
      }
      const { error } = await supabase.rpc("admin_grant_access", {
        _user_id: row.user_id,
        _plan: plan as "starter" | "creator" | "studio",
        _credits_seconds: credits,
        _mode: mode,
      });
      if (error) throw error;
      toast.success(`Granted access to ${row.full_name ?? "user"}`);
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to grant access";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Grant free access</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          For <span className="font-medium text-foreground">{row.full_name ?? row.user_id.slice(0, 8)}</span> · current plan{" "}
          <span className="capitalize">{row.plan}</span> · {row.credits_seconds}s credits
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Plan</label>
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
              {(["starter", "creator", "studio"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`px-3 py-2 text-xs capitalize ${plan === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-muted-foreground">Free credits (seconds)</label>
              <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
                <button
                  onClick={() => setMode("add")}
                  className={`px-2 py-0.5 ${mode === "add" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  Add
                </button>
                <button
                  onClick={() => setMode("set")}
                  className={`px-2 py-0.5 ${mode === "set" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  Set
                </button>
              </div>
            </div>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="e.g. 3600"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setMode("add"); setAmount(String(p.secs)); }}
                  className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-secondary"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => { setMode("set"); setAmount("999999999"); }}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
              >
                Unlimited
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {mode === "add" ? "Adds to current balance." : "Overwrites current balance."} Leave empty to keep unchanged.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Grant access
          </button>
        </div>
      </div>
    </div>
  );
};


const InviteAdminByEmail = ({ onDone }: { onDone: () => void }) => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_role", {
        _user_id: null,
        _email: e,
        _role: "admin",
        _grant: true,
      });
      if (error) throw error;
      toast.success(`Admin granted to ${e}`);
      setEmail("");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to grant admin");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        onKeyDown={(ev) => ev.key === "Enter" && submit()}
        placeholder="Grant admin by email"
        type="email"
        className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={submit}
        disabled={busy || !email.trim()}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Make admin
      </button>
    </div>
  );
};

export default AdminUsage;

