import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, EmptyState, TableSkeleton, StatusBadge } from "@/components/admin/primitives";

type Row = {
  id: string; user_id: string | null; created_at: string; outcome: string;
  resolution: string; codec: string; encode_time_ms: number; output_bytes: number | null;
  path: string | null; error_message: string | null;
};

export default function AdminExportsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    let q = supabase.from("export_metrics").select("*").order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("outcome", status);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  }, [status]);

  useEffect(() => { void refresh(); }, [status, refresh]);

  const paged = useMemo(() => rows?.slice(page * pageSize, page * pageSize + pageSize) ?? null, [rows, page, pageSize]);

  const doDelete = async (r: Row) => {
    const { error } = await supabase.from("export_metrics").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); refresh(); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Exports & Renders" description="Every render job across all users." />

      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map(n => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-x-auto">
            {paged == null ? (
              <TableSkeleton rows={6} cols={6} />
            ) : paged.length === 0 ? (
              <EmptyState icon={Download} title="No exports yet" description="Users' render outputs will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Codec</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Encode</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>{r.resolution}</TableCell>
                      <TableCell className="uppercase">{r.codec}</TableCell>
                      <TableCell><StatusBadge status={r.outcome} /></TableCell>
                      <TableCell className="tabular-nums">{Math.round(r.encode_time_ms)}ms</TableCell>
                      <TableCell className="tabular-nums">{r.output_bytes ? `${(r.output_bytes / 1024 / 1024).toFixed(1)}MB` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => doDelete(r)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {rows && rows.length > pageSize && (
            <div className="mt-3 flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(rows.length / pageSize)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
