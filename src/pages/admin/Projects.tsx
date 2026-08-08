import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Search, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetch } from "@/lib/adminFetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableRow, TableHead } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader, EmptyState, TableSkeleton, StatusBadge } from "@/components/admin/primitives";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks/useDebounced";
import { VirtualTable } from "@/components/admin/VirtualTable";

type Row = {
  id: string; title: string; status: string;
  duration_seconds: number | null; created_at: string;
  user_id: string; owner_email: string | null;
};

export default function AdminProjectsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [status, setStatus] = useState("all");
  const [confirmDel, setConfirmDel] = useState<Row | null>(null);

  const listKey = ["admin", "projects", status, dq] as const;
  const { data: rows } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (status !== "all") searchParams.set("status", status);
      if (dq) searchParams.set("search", dq);
      const res = await adminFetch(`/functions/v1/admin-api/projects?${searchParams.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as Row[];
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const patchCache = (updater: (rows: Row[]) => Row[]) => {
    const prev = qc.getQueryData<Row[]>(listKey);
    if (prev) qc.setQueryData(listKey, updater(prev));
    return prev;
  };

  useEffect(() => {
    const ch = supabase
      .channel("admin_projects_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const retriggerM = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("projects").update({ status: "uploading" as any, error_message: null }).eq("id", r.id);
      if (error) throw error;
    },
    onMutate: (r) => ({ prev: patchCache((rs) => rs.map((x) => x.id === r.id ? { ...x, status: "uploading" } : x)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(listKey, ctx.prev); toast.error((err as Error).message); },
    onSuccess: () => toast.success("Re-triggered"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "projects"] }),
  });

  const deleteM = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("projects").delete().eq("id", r.id);
      if (error) throw error;
    },
    onMutate: (r) => ({ prev: patchCache((rs) => rs.filter((x) => x.id !== r.id)) }),
    onError: (err, _v, ctx) => { if (ctx?.prev) qc.setQueryData(listKey, ctx.prev); toast.error((err as Error).message); },
    onSuccess: () => { toast.success("Project deleted"); setConfirmDel(null); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "projects"] }),
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Projects" description="All user projects. Failed rows are tinted red." />

      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or owner email" className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="uploading">Uploading</SelectItem>
                <SelectItem value="transcribing">Transcribing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="exporting">Exporting</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            {rows && (
              <span className="text-[13px] text-muted-foreground shrink-0 sm:ml-2">
                {rows.length.toLocaleString()} {rows.length === 1 ? "project" : "projects"}
              </span>
            )}
          </div>

          <div className="mt-4">
            {rows == null ? (
              <TableSkeleton rows={6} cols={6} />
            ) : (
              <VirtualTable<Row>
                rows={rows}
                rowKey={(r) => r.id}
                colCount={6}
                maxHeight={560}
                estimateRowHeight={48}
                emptyState={<EmptyState icon={FolderKanban} title="No projects" description="Nothing matches your filters yet." />}
                header={
                  <TableRow>
                    <TableHead className="w-[28%]">Title</TableHead>
                    <TableHead className="w-[22%]">Owner</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[10%]">Duration</TableHead>
                    <TableHead className="w-[14%]">Created</TableHead>
                    <TableHead className="w-[14%] text-right">Actions</TableHead>
                  </TableRow>
                }
                renderRow={(r) => (
                  <>
                    <td className={cn("p-2 font-medium truncate", r.status === "failed" && "bg-red-500/5")}>{r.title}</td>
                    <td className="p-2 text-muted-foreground truncate">{r.owner_email ?? "—"}</td>
                    <td className="p-2"><StatusBadge status={r.status} /></td>
                    <td className="p-2 tabular-nums">{r.duration_seconds ? `${Math.round(r.duration_seconds)}s` : "—"}</td>
                    <td className="p-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" title="View project">
                          <Link to={`/dashboard/project/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                        {r.status === "failed" && (
                          <Button size="sm" variant="ghost" onClick={() => retriggerM.mutate(r)} title="Re-trigger">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDel(r)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{confirmDel?.title}</strong> and all its captions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && deleteM.mutate(confirmDel)} className="bg-red-500 hover:bg-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
