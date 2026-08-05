import { lazy, Suspense, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, FolderKanban, Download, IndianRupee, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, SectionHeader, EmptyState, TableSkeleton, pctDelta, formatINR } from "@/components/admin/primitives";
import { Card, CardContent } from "@/components/ui/card";

const OverviewCharts = lazy(() => import("./OverviewCharts"));



type Stats = {
  total_users: number; users_30: number; users_prev: number;
  active_projects: number; projects_30: number; projects_prev: number;
  total_exports: number; exports_30: number; exports_prev: number;
  revenue_30_paise: number; revenue_prev_paise: number;
  signups_series: { day: string; count: number }[];
  projects_series: { day: string; count: number }[];
};

type Activity = {
  id: string; user_id: string | null; email: string | null;
  action_type: string; metadata: Record<string, any>; created_at: string;
};



const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const actionLabel = (a: Activity) => {
  const meta = a.metadata || {};
  switch (a.action_type) {
    case "user_signup": return `New signup — ${meta.email ?? a.email ?? "unknown"}`;
    case "project_created": return `Project created — ${meta.title ?? "untitled"}`;
    case "export_completed": return `Export completed — ${meta.resolution ?? ""} ${meta.codec ?? ""}`.trim();
    case "payment_received": return `Payment received — ${formatINR(meta.amount_paise ?? 0)}`;
    default: return a.action_type;
  }
};

const STATS_KEY = ["admin", "overview", "stats"] as const;
const ACTIVITY_KEY = ["admin", "overview", "activity"] as const;

export default function Overview() {
  const qc = useQueryClient();

  const { data: stats, error: statsErrObj } = useQuery({
    queryKey: STATS_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_overview_stats");
      if (error) throw error;
      return data as Stats;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const statsError = statsErrObj ? (statsErrObj as any).message : null;

  const { data: activity } = useQuery({
    queryKey: ACTIVITY_KEY,
    queryFn: async () => {
      const { data } = await (supabase.rpc as any)("admin_recent_activity", { _limit: 10 });
      return (data as Activity[]) ?? [];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin_activity_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => {
        qc.invalidateQueries({ queryKey: ACTIVITY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const revenueValue = useMemo(
    () => stats ? formatINR(stats.revenue_30_paise) : "—",
    [stats]
  );



  return (
    <div className="space-y-8">
      <SectionHeader title="Overview" description="Real-time platform metrics for the last 30 days." />

      {statsError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-400">
          Failed to load stats: {statsError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats?.total_users?.toLocaleString() ?? "—"}
          delta={stats ? pctDelta(stats.users_30, stats.users_prev) : null}
          hint={stats ? `+${stats.users_30} in 30d` : undefined}
          loading={!stats}
        />
        <StatCard
          label="Active projects"
          value={stats?.active_projects?.toLocaleString() ?? "—"}
          delta={stats ? pctDelta(stats.projects_30, stats.projects_prev) : null}
          hint={stats ? `+${stats.projects_30} in 30d` : undefined}
          loading={!stats}
        />
        <StatCard
          label="Total exports"
          value={stats?.total_exports?.toLocaleString() ?? "—"}
          delta={stats ? pctDelta(stats.exports_30, stats.exports_prev) : null}
          hint={stats ? `+${stats.exports_30} in 30d` : undefined}
          loading={!stats}
        />
        <StatCard
          label="Revenue (30d)"
          value={revenueValue}
          delta={stats ? pctDelta(stats.revenue_30_paise, stats.revenue_prev_paise) : null}
          hint={stats && stats.revenue_30_paise === 0 ? "No payments yet" : undefined}
          loading={!stats}
        />
      </div>

      {stats ? (
        <Suspense fallback={<div className="h-56"><TableSkeleton rows={4} cols={1} /></div>}>
          <OverviewCharts signups={stats.signups_series} projects={stats.projects_series} />
        </Suspense>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60"><CardContent className="p-4 sm:p-5 h-56"><TableSkeleton rows={4} cols={1} /></CardContent></Card>
          <Card className="border-border/60"><CardContent className="p-4 sm:p-5 h-56"><TableSkeleton rows={4} cols={1} /></CardContent></Card>
        </div>
      )}


      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Recent activity</p>
            <Link to="/admin/users" className="text-[13px] text-primary hover:underline">View all users →</Link>
          </div>
          {activity == null ? (
            <TableSkeleton rows={5} cols={1} />
          ) : activity.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Signups, project creations, exports and payments will show up here in real time." />
          ) : (
            <ul className="divide-y divide-border/50">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{actionLabel(a)}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{a.email ?? "system"}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
