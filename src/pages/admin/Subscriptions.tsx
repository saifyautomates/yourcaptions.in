import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from "recharts";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetch } from "@/lib/adminFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, StatCard, EmptyState, TableSkeleton, StatusBadge, formatINR } from "@/components/admin/primitives";

type Summary = {
  mrr_paise: number; paid_users: number; churned: number; new_paid: number;
  revenue_series: { month: string; revenue_paise: number }[];
};
type Sub = {
  id: string; user_id: string; plan: string; status: string;
  razorpay_subscription_id: string | null; current_period_end: string | null; created_at: string;
  email?: string;
};

export default function AdminSubscriptionsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [subs, setSubs] = useState<Sub[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/functions/v1/admin-api/subscriptions-summary");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) setSummary((Array.isArray(data) ? data[0] : data) as Summary);
      } catch (e) {
        console.error("Failed to load summary", e);
      }
    })();
    (async () => {
      const { data } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(100);
      if (!cancelled) setSubs((data as any) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const hasData = useMemo(() => summary && (summary.mrr_paise > 0 || summary.paid_users > 0), [summary]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Subscriptions & Revenue" description="Live paid-user and revenue metrics from the database." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="MRR (30d)" value={summary ? formatINR(summary.mrr_paise) : "—"} loading={!summary} />
        <StatCard label="Paid users" value={summary?.paid_users?.toLocaleString() ?? "—"} loading={!summary} />
        <StatCard label="Churned (30d)" value={summary?.churned?.toLocaleString() ?? "—"} loading={!summary} />
        <StatCard label="New paid (30d)" value={summary?.new_paid?.toLocaleString() ?? "—"} loading={!summary} />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Revenue — last 12 months</p>
          <div className="h-64">
            {!summary ? (
              <TableSkeleton rows={4} cols={1} />
            ) : hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.revenue_series.map(d => ({ ...d, rev: d.revenue_paise / 100 }))}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="rev" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={CreditCard} title="No revenue data yet" description="Connect a payment provider (Stripe or Paddle) and receive payments to populate this chart." />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">All subscriptions</p>
          <div className="overflow-x-auto">
            {subs == null ? (
              <TableSkeleton rows={5} cols={5} />
            ) : subs.length === 0 ? (
              <EmptyState icon={CreditCard} title="No subscriptions yet" description="Subscriptions from Razorpay / Stripe will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider ID</TableHead>
                    <TableHead>Next billing</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-[12px]">{s.user_id.slice(0, 8)}…</TableCell>
                      <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-[12px] uppercase">{s.plan}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{s.razorpay_subscription_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
