import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon, Search, Trash2, Shield, ShieldOff, ExternalLink, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetch } from "@/lib/adminFetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader, EmptyState, TableSkeleton } from "@/components/admin/primitives";
import { useDebounced } from "@/hooks/useDebounced";
import { VirtualTable } from "@/components/admin/VirtualTable";
import { TableRow, TableHead } from "@/components/ui/table";

type Row = {
  user_id: string; email: string | null; full_name: string | null;
  plan: "starter" | "creator" | "studio"; credits_seconds: number;
  is_admin: boolean; created_at: string | null;
};

const USERS_KEY = ["admin", "users"] as const;

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const { data: rows } = useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const res = await adminFetch("/functions/v1/admin-api/users");
      if (!res.ok) throw new Error(await res.text());
      return await res.json() as Row[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = dq.toLowerCase();
    return rows.filter((r) => {
      const matchQ = !needle || r.email?.toLowerCase().includes(needle) || r.full_name?.toLowerCase().includes(needle);
      const matchPlan = planFilter === "all" || r.plan === planFilter;
      return matchQ && matchPlan;
    });
  }, [rows, dq, planFilter]);

  const admins = useMemo(() => filtered?.filter((r) => r.is_admin) ?? null, [filtered]);
  const regularUsers = useMemo(() => filtered?.filter((r) => !r.is_admin) ?? null, [filtered]);

  const renderRow = (r: Row) => (
    <>
      <td className="p-2 font-medium truncate cursor-pointer" onClick={() => setDrawer(r)}>{r.email ?? "—"}</td>
      <td className="p-2 text-muted-foreground truncate">{r.full_name ?? "—"}</td>
      <td className="p-2"><span className="rounded-full bg-secondary px-2 py-0.5 text-[12px] uppercase">{r.plan}</span></td>
      <td className="p-2 tabular-nums">{Math.round((r.credits_seconds ?? 0) / 60)}m</td>
      <td className="p-2">{r.is_admin ? <span className="text-primary">Yes</span> : <span className="text-muted-foreground">—</span>}</td>
      <td className="p-2 text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
      <td className="p-2 text-right">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setConfirmDelete(r); }} className="text-red-400 hover:text-red-300">
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </>
  );

  const header = (
    <TableRow>
      <TableHead className="w-[24%]">Email</TableHead>
      <TableHead className="w-[16%]">Name</TableHead>
      <TableHead className="w-[10%]">Plan</TableHead>
      <TableHead className="w-[10%]">Credits</TableHead>
      <TableHead className="w-[8%]">Admin</TableHead>
      <TableHead className="w-[14%]">Joined</TableHead>
      <TableHead className="w-[8%] text-right">Actions</TableHead>
    </TableRow>
  );

  // ---------- optimistic mutations ----------
  const patchCache = (updater: (rows: Row[]) => Row[]) => {
    const prev = qc.getQueryData<Row[]>(USERS_KEY);
    if (prev) qc.setQueryData(USERS_KEY, updater(prev));
    return prev;
  };

  const setPlanM = useMutation({
    mutationFn: async ({ r, plan }: { r: Row; plan: string }) => {
      const res = await adminFetch("/functions/v1/admin-api/users/grant-access", {
        method: "POST",
        body: JSON.stringify({ _user_id: r.user_id, _plan: plan, _mode: "set" })
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: ({ r, plan }) => ({ prev: patchCache((rs) => rs.map((x) => x.user_id === r.user_id ? { ...x, plan: plan as Row["plan"] } : x)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(USERS_KEY, ctx.prev); toast.error((err as Error).message); },
    onSuccess: (_d, v) => toast.success(`Set ${v.r.email} → ${v.plan}`),
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });

  const adminM = useMutation({
    mutationFn: async (r: Row) => {
      const res = await adminFetch("/functions/v1/admin-api/users/set-role", {
        method: "POST",
        body: JSON.stringify({ _user_id: r.user_id, _role: "admin", _grant: !r.is_admin })
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: (r) => ({ prev: patchCache((rs) => rs.map((x) => x.user_id === r.user_id ? { ...x, is_admin: !x.is_admin } : x)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(USERS_KEY, ctx.prev); toast.error((err as Error).message); },
    onSuccess: (_d, r) => toast.success(r.is_admin ? "Admin revoked" : "Admin granted"),
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });

  const creditsM = useMutation({
    mutationFn: async ({ r, seconds }: { r: Row; seconds: number }) => {
      const res = await adminFetch("/functions/v1/admin-api/users/grant-access", {
        method: "POST",
        body: JSON.stringify({ _user_id: r.user_id, _credits_seconds: seconds, _mode: "add" })
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: ({ r, seconds }) => ({ prev: patchCache((rs) => rs.map((x) => x.user_id === r.user_id ? { ...x, credits_seconds: (x.credits_seconds ?? 0) + seconds } : x)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(USERS_KEY, ctx.prev); toast.error((err as Error).message); },
    onSuccess: (_d, v) => toast.success(`Added ${v.seconds}s to ${v.r.email}`),
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });

  const deleteM = useMutation({
    mutationFn: async (r: Row) => {
      const res = await adminFetch("/functions/v1/admin-api/users/delete", {
        method: "POST",
        body: JSON.stringify({ _user_id: r.user_id })
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: (r) => ({ prev: patchCache((rs) => rs.filter((x) => x.user_id !== r.user_id)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(USERS_KEY, ctx.prev); toast.error((err as Error).message); },
    onSuccess: () => { toast.success("User deleted"); setConfirmDelete(null); setConfirmText(""); },
    onSettled: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Users & Admins" description="Regular users and administrators are listed separately." />

      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-8" />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
              </SelectContent>
            </Select>
            {filtered && (
              <span className="text-[13px] text-muted-foreground shrink-0 sm:ml-2">
                {regularUsers?.length ?? 0} users · {admins?.length ?? 0} admins
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Users</h3>
            <span className="text-[13px] text-muted-foreground">{regularUsers?.length ?? 0} total</span>
          </div>
          {regularUsers == null ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (
            <VirtualTable<Row>
              rows={regularUsers}
              rowKey={(r) => r.user_id}
              colCount={7}
              maxHeight={480}
              estimateRowHeight={48}
              emptyState={<EmptyState icon={UsersIcon} title="No users match" description="Adjust filters or clear the search." />}
              header={header}
              renderRow={renderRow}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Administrators</h3>
            <span className="text-[13px] text-muted-foreground">{admins?.length ?? 0} total</span>
          </div>
          {admins == null ? (
            <TableSkeleton rows={3} cols={7} />
          ) : (
            <VirtualTable<Row>
              rows={admins}
              rowKey={(r) => r.user_id}
              colCount={7}
              maxHeight={320}
              estimateRowHeight={48}
              emptyState={<EmptyState icon={Shield} title="No admins" description="No administrator accounts yet." />}
              header={header}
              renderRow={renderRow}
            />
          )}
        </CardContent>
      </Card>


      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{drawer?.email ?? "User"}</SheetTitle></SheetHeader>
          {drawer && (
            <div className="mt-4 space-y-4 text-sm">
              <div><span className="text-muted-foreground">User ID:</span> <code className="text-[12px]">{drawer.user_id}</code></div>
              <div><span className="text-muted-foreground">Full name:</span> {drawer.full_name ?? "—"}</div>
              <div><span className="text-muted-foreground">Joined:</span> {drawer.created_at ? new Date(drawer.created_at).toLocaleString() : "—"}</div>
              <div><span className="text-muted-foreground">Credits:</span> {Math.round((drawer.credits_seconds ?? 0) / 60)} minutes</div>

              <div className="border-t border-border/60 pt-4">
                <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Plan</p>
                <Select value={drawer.plan} onValueChange={(v) => setPlanM.mutate({ r: drawer, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border/60 pt-4">
                <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">Grant credits</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => creditsM.mutate({ r: drawer, seconds: 1800 })}>+30 min</Button>
                  <Button size="sm" variant="outline" onClick={() => creditsM.mutate({ r: drawer, seconds: 3600 })}>+60 min</Button>
                  <Button size="sm" variant="outline" onClick={() => creditsM.mutate({ r: drawer, seconds: 18000 })}>+5 hr</Button>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <Button size="sm" variant="outline" onClick={() => adminM.mutate(drawer)}>
                  {drawer.is_admin ? <><ShieldOff className="mr-2 h-4 w-4" />Revoke admin</> : <><Shield className="mr-2 h-4 w-4" />Grant admin</>}
                </Button>
              </div>

              <div className="border-t border-border/60 pt-4">
                <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5" /> Projects
                </p>
                <UserProjectsList userId={drawer.user_id} email={drawer.email} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) { setConfirmDelete(null); setConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{confirmDelete?.email}</strong> and all their data.
              Type <code className="bg-secondary px-1 rounded">{confirmDelete?.email}</code> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type email to confirm" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={confirmText !== confirmDelete?.email} onClick={() => confirmDelete && deleteM.mutate(confirmDelete)} className="bg-red-500 hover:bg-red-600">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserProjectsList({ userId, email }: { userId: string; email: string | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "user-projects", userId],
    queryFn: async () => {
      const res = await adminFetch(`/functions/v1/admin-api/projects`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return (data as Array<{ id: string; title: string; status: string; created_at: string; user_id: string; duration_seconds: number | null }>)
        .filter((p) => p.user_id === userId);
    },
    staleTime: 15_000,
  });

  if (isLoading) return <p className="text-[13px] text-muted-foreground">Loading projects…</p>;
  if (error) return <p className="text-[13px] text-red-400">Failed to load projects.</p>;
  if (!data || data.length === 0) return <p className="text-[13px] text-muted-foreground">No projects yet.</p>;

  return (
    <div className="max-h-64 overflow-y-auto rounded border border-border/60 divide-y divide-border/60">
      {data.map((p) => (
        <Link
          key={p.id}
          to={`/dashboard/project/${p.id}`}
          className="flex items-center justify-between gap-2 p-2 text-[13px] hover:bg-secondary/50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{p.title || "Untitled"}</div>
            <div className="text-[12px] text-muted-foreground flex items-center gap-2">
              <span className="uppercase">{p.status}</span>
              <span>·</span>
              <span>{new Date(p.created_at).toLocaleDateString()}</span>
              {p.duration_seconds ? <><span>·</span><span>{Math.round(p.duration_seconds)}s</span></> : null}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  );
}
