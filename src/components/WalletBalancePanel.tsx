// Wallet balance panel — shows plan credits, top-up credits, and total
// available balance. Live-updates via the useCredits hook (which subscribes
// to credit_wallets changes in realtime).

import { Link } from "react-router-dom";
import { Wallet, Sparkles, Plus, CalendarClock } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString();
const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const daysUntil = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));

export function WalletBalancePanel({ className = "" }: { className?: string }) {
  const { loading, planCredits, topupCredits, balance, blocked } = useCredits();
  const { planName, renewsAt, isPaid, status } = usePlanInfo();

  if (loading) {
    return (
      <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-10 w-40 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const planPct = balance > 0 ? Math.round((planCredits / balance) * 100) : 0;

  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Wallet balance
        </div>
        {blocked ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
            Out of credits
          </span>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          isPaid ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          <Sparkles className="h-3 w-3" /> {planName} plan
        </span>
        {renewsAt && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            title={`Plan credits replenish on ${dateFmt.format(renewsAt)}`}
          >
            <CalendarClock className="h-3 w-3" />
            {isPaid ? "Renews" : "Resets"} {dateFmt.format(renewsAt)}
            <span className="opacity-70">· in {daysUntil(renewsAt)}d</span>
          </span>
        )}
        {status && status !== "active" && isPaid && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-amber-600">
            {status}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold tracking-tight">{fmt(balance)}</span>
        <span className="text-xs text-muted-foreground">credits available</span>
      </div>

      {balance > 0 && (
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-primary" style={{ width: `${planPct}%` }} />
          <div className="h-full bg-amber-500" style={{ width: `${100 - planPct}%` }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-primary" /> Plan
          </div>
          <div className="text-xl font-semibold mt-1">{fmt(planCredits)}</div>
          <div className="text-[11px] text-muted-foreground">
            {renewsAt ? `${isPaid ? "Renews" : "Resets"} ${dateFmt.format(renewsAt)}` : "Resets monthly"}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Top-up
          </div>
          <div className="text-xl font-semibold mt-1">{fmt(topupCredits)}</div>
          <div className="text-[11px] text-muted-foreground">Never expires</div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button asChild size="sm" className="flex-1">
          <Link to="/pricing">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Upgrade plan
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link to="/pricing?topup=1">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buy top-up
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default WalletBalancePanel;
