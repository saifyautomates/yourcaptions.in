import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ShieldOff, Loader2 } from "lucide-react";

interface Row {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
}

/**
 * Admin-only page to grant or revoke the `admin` role for any signed-up user.
 * Backed by the security-definer RPCs `admin_list_users` and `admin_set_role`
 * — both self-check `has_role(auth.uid(),'admin')` so this page can only be
 * used by existing admins.
 */
export default function AdminRoles() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error(error.message);
    } else {
      setRows(
        (data ?? []).map((r: any) => ({
          user_id: r.user_id,
          email: r.email,
          full_name: r.full_name,
          is_admin: r.is_admin,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setRole = async (opts: { user_id?: string; email?: string; grant: boolean }) => {
    const key = opts.user_id ?? opts.email ?? "";
    setBusy(key);
    const { error } = await supabase.rpc("admin_set_role", {
      _user_id: opts.user_id ?? undefined,
      _email: opts.email ?? undefined,
      _role: "admin",
      _grant: opts.grant,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(opts.grant ? "Admin access granted" : "Admin access revoked");
    if (opts.email) setInviteEmail("");
    void load();
  };

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Role management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant or revoke admin access. Changes apply on the user's next page load.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium">Grant by email</div>
          <p className="mt-1 text-xs text-muted-foreground">
            The user must have signed up at least once. Use this to promote accounts you don't see below.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const email = inviteEmail.trim();
              if (!email) return;
              void setRole({ email, grant: true });
            }}
          >
            <Input
              type="email"
              placeholder="person@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" disabled={!inviteEmail.trim() || busy === inviteEmail.trim()}>
              {busy === inviteEmail.trim() ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant admin"}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border p-3">
            <Input
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          <div className="divide-y divide-border">
            {loading && rows.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading users…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No users match.</div>
            )}
            {filtered.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.full_name || r.email || r.user_id}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{r.email ?? r.user_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Member</span>
                  )}
                  {r.is_admin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setRole({ user_id: r.user_id, grant: false })}
                      disabled={busy === r.user_id}
                    >
                      {busy === r.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldOff className="mr-1 h-4 w-4" /> Revoke
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void setRole({ user_id: r.user_id, grant: true })}
                      disabled={busy === r.user_id}
                    >
                      {busy === r.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Shield className="mr-1 h-4 w-4" /> Grant
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
