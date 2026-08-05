import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ShieldAlert, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Kind = "role_granted" | "role_revoked" | "admin_access_denied" | "admin_access_ok";

interface Alert {
  id: string;
  kind: Kind;
  actor_id: string | null;
  actor_email: string | null;
  subject_id: string | null;
  subject_email: string | null;
  role: string | null;
  path: string | null;
  suspicious: boolean;
  reason: string | null;
  created_at: string;
}

const KIND_META: Record<Kind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  role_granted: { label: "Role granted", icon: UserPlus },
  role_revoked: { label: "Role revoked", icon: UserMinus },
  admin_access_denied: { label: "Admin access denied", icon: ShieldAlert },
  admin_access_ok: { label: "Admin access", icon: ShieldCheck },
};

export default function AdminSecurityAlerts() {
  const [rows, setRows] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlySuspicious, setOnlySuspicious] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("admin_security_alerts", { _limit: 200 });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Alert[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const suspiciousCount = useMemo(() => rows.filter((r) => r.suspicious).length, [rows]);
  const filtered = useMemo(
    () => (onlySuspicious ? rows.filter((r) => r.suspicious) : rows),
    [rows, onlySuspicious],
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldAlert className="h-6 w-6 text-primary" /> Security alerts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Role changes and admin-route access attempts. Suspicious patterns (self-role
              changes, burst grants/revokes, or 3+ denied admin access attempts within 10
              minutes) are flagged automatically.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total events" value={rows.length} />
          <StatCard label="Suspicious" value={suspiciousCount} tone={suspiciousCount ? "warn" : "ok"} />
          <StatCard label="Role changes" value={rows.filter((r) => r.kind.startsWith("role_")).length} />
          <StatCard
            label="Denied access"
            value={rows.filter((r) => r.kind === "admin_access_denied").length}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlySuspicious}
              onChange={(e) => setOnlySuspicious(e.target.checked)}
            />
            Show only suspicious
          </label>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {loading && rows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {onlySuspicious ? "No suspicious activity. 🎉" : "No events yet."}
            </div>
          )}
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const Meta = KIND_META[r.kind] ?? KIND_META.admin_access_ok;
              const Icon = Meta.icon;
              return (
                <li key={r.id} className="flex items-start gap-3 p-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      r.suspicious
                        ? "bg-destructive/15 text-destructive"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {r.suspicious ? <AlertTriangle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium">{Meta.label}</span>
                      {r.role && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {r.role}
                        </span>
                      )}
                      {r.suspicious && r.reason && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                          {r.reason}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.kind.startsWith("role_") ? (
                        <>
                          <span className="font-mono">{r.actor_email ?? r.actor_id ?? "system"}</span>
                          {" → "}
                          <span className="font-mono">{r.subject_email ?? r.subject_id ?? "?"}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono">{r.actor_email ?? r.actor_id ?? "unknown"}</span>
                          {r.path ? <> · <span className="font-mono">{r.path}</span></> : null}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneClass =
    tone === "warn" && value > 0
      ? "text-destructive"
      : tone === "ok"
      ? "text-green-500"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
