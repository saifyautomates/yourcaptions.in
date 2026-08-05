import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, EmptyState, TableSkeleton, StatusBadge } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";

type FailedProject = { id: string; title: string; error_message: string | null; created_at: string; user_id: string };
type FailedExport = { id: string; error_message: string | null; created_at: string; codec: string; resolution: string };
type Alert = { id: string; kind: string; actor_email: string | null; reason: string | null; created_at: string; path: string | null };

export default function AdminReportsPage() {
  const [projects, setProjects] = useState<FailedProject[] | null>(null);
  const [exports, setExports] = useState<FailedExport[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("projects").select("id,title,error_message,created_at,user_id").eq("status", "failed" as any).order("created_at", { ascending: false }).limit(50);
      if (!cancelled) setProjects((data as any) ?? []);
    })();
    (async () => {
      const { data } = await supabase.from("export_metrics").select("id,error_message,created_at,codec,resolution").eq("outcome", "failed").order("created_at", { ascending: false }).limit(50);
      if (!cancelled) setExports((data as any) ?? []);
    })();
    (async () => {
      const { data } = await (supabase.rpc as any)("admin_security_alerts", { _limit: 30 });
      if (!cancelled) setAlerts((data as any) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader title="Reports & Flags" description="Failed jobs and suspicious activity that need review." />

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Failed projects</p>
          {projects == null ? <TableSkeleton rows={4} cols={4} /> :
            projects.length === 0 ? <EmptyState icon={Flag} title="No failed projects" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Error</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow key={p.id} className="bg-red-500/5">
                        <TableCell className="font-medium max-w-[240px] truncate">{p.title}</TableCell>
                        <TableCell className="text-red-400 text-[13px] max-w-[380px] truncate">{p.error_message ?? "Unknown"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost"><Link to={`/dashboard/project/${p.id}`}><ExternalLink className="h-4 w-4" /></Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Failed exports</p>
          {exports == null ? <TableSkeleton rows={4} cols={3} /> :
            exports.length === 0 ? <EmptyState icon={Flag} title="No failed exports" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Codec</TableHead><TableHead>Resolution</TableHead><TableHead>Error</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {exports.map((e) => (
                      <TableRow key={e.id} className="bg-red-500/5">
                        <TableCell className="uppercase">{e.codec}</TableCell>
                        <TableCell>{e.resolution}</TableCell>
                        <TableCell className="text-red-400 text-[13px] max-w-[380px] truncate">{e.error_message ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Suspicious security events</p>
            <Link to="/admin/alerts" className="text-[13px] text-primary hover:underline">View all →</Link>
          </div>
          {alerts == null ? <TableSkeleton rows={4} cols={4} /> :
            alerts.length === 0 ? <EmptyState icon={Flag} title="No security alerts" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Actor</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><StatusBadge status={a.kind} /></TableCell>
                        <TableCell className="text-muted-foreground">{a.actor_email ?? "—"}</TableCell>
                        <TableCell className="text-[13px]">{a.reason ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
