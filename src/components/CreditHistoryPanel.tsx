// Credit transaction history — shows reserves, deductions, refunds, top-ups,
// plan grants, and admin adjustments for the signed-in user. Live-updates via
// a realtime subscription on credit_transactions filtered by user_id, so a
// deduct that lands from an edge function appears without a manual refresh.

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Undo2,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TxType =
  | "deduct"
  | "refund"
  | "topup_purchase"
  | "plan_grant"
  | "admin_adjust";
type TxStatus = "reserved" | "completed" | "reversed" | "failed";

interface Transaction {
  id: string;
  type: TxType | string;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  status: TxStatus | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type FilterKey = "all" | "deduct" | "refund" | "topup" | "reserved";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deduct", label: "Deductions" },
  { key: "refund", label: "Refunds" },
  { key: "topup", label: "Top-ups" },
  { key: "reserved", label: "Reserved" },
];

const PAGE = 25;

// Signed amount: deductions/reserves subtract from the wallet, everything
// else adds. Used purely for presentation (the DB always stores absolute).
function signedAmount(t: Transaction) {
  const isDebit = t.type === "deduct" && t.status !== "reversed";
  return isDebit ? -t.amount : t.amount;
}

function typeMeta(t: Transaction) {
  switch (t.type) {
    case "deduct":
      return {
        label: t.status === "reserved" ? "Reserved" : "Deduction",
        icon: t.status === "reserved" ? Clock3 : ArrowDownRight,
        tone: t.status === "reserved" ? "text-amber-500" : "text-destructive",
      };
    case "refund":
      return { label: "Refund", icon: Undo2, tone: "text-green-500" };
    case "topup_purchase":
      return { label: "Top-up", icon: ArrowUpRight, tone: "text-green-500" };
    case "plan_grant":
      return { label: "Plan credits", icon: CircleDollarSign, tone: "text-primary" };
    case "admin_adjust":
      return { label: "Admin adjust", icon: ShieldCheck, tone: "text-primary" };
    default:
      return { label: t.type, icon: History, tone: "text-muted-foreground" };
  }
}

function statusPill(s: string) {
  const map: Record<string, string> = {
    completed: "bg-green-500/10 text-green-500",
    reserved: "bg-amber-500/10 text-amber-500",
    reversed: "bg-muted text-muted-foreground line-through",
    failed: "bg-destructive/10 text-destructive",
  };
  return map[s] || "bg-muted text-muted-foreground";
}

const fmtAmount = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

export function CreditHistoryPanel({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { append?: boolean; silent?: boolean } = {}) => {
      if (!user) return;
      const { append, silent } = opts;
      if (!silent) (append ? setRefreshing : setLoading)(true);
      setError(null);
      const from = (append ? page : 0) * PAGE;
      const to = from + PAGE; // fetch one extra to detect hasMore
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        if (error.message.includes("Could not find the table") && error.message.includes("schema cache")) {
          // Graceful fallback if the backend schema cache is stale
          setRows([]);
          setHasMore(false);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        setError(error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const list = (data ?? []) as Transaction[];
      const more = list.length > PAGE;
      const trimmed = more ? list.slice(0, PAGE) : list;
      setRows((prev) => (append ? [...prev, ...trimmed] : trimmed));
      setHasMore(more);
      setLoading(false);
      setRefreshing(false);
    },
    [user, page],
  );

  useEffect(() => {
    setPage(0);
    void load();
  }, [user, load]);

  // Realtime — a new deduction / refund appears without user action.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`credit-tx-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setPage(0);
          void load({ silent: true });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "topup") return rows.filter((r) => r.type === "topup_purchase");
    if (filter === "reserved")
      return rows.filter((r) => r.status === "reserved");
    return rows.filter((r) => r.type === filter);
  }, [rows, filter]);

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Credit history</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPage(0);
            void load();
          }}
          disabled={loading || refreshing}
          className="h-8 px-2 text-muted-foreground"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div className="flex gap-1 mb-3 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-destructive py-6">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          No transactions yet. Actions like transcription, dubbing and top-ups
          will appear here.
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <ul className="divide-y divide-border/60">
            {filtered.map((t) => {
              const meta = typeMeta(t);
              const Icon = meta.icon;
              const signed = signedAmount(t);
              const when = new Date(t.created_at);
              const refLabel = t.reference_type
                ? `${t.reference_type}${t.reference_id ? ` · ${t.reference_id.slice(0, 8)}` : ""}`
                : null;
              return (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                          statusPill(t.status),
                        )}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{formatDistanceToNow(when, { addSuffix: true })}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {when.toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                      {refLabel && (
                        <>
                          <span>·</span>
                          <span className="truncate">{refLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        signed < 0
                          ? "text-destructive"
                          : signed > 0
                            ? "text-green-500"
                            : "text-muted-foreground",
                      )}
                    >
                      {fmtAmount(signed)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      bal {Math.round(Number(t.balance_after) || 0).toLocaleString()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      )}

      {hasMore && !loading && (
        <div className="pt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((p) => p + 1);
              void load({ append: true });
            }}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default CreditHistoryPanel;
