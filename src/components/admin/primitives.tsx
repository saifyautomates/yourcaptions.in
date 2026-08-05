import { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: string;
  loading?: boolean;
}) {
  const trend =
    delta == null || !isFinite(delta) ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const tone =
    trend === "up"
      ? "text-green-400 bg-green-400/10"
      : trend === "down"
        ? "text-red-400 bg-red-400/10"
        : "text-muted-foreground bg-muted/40";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight">{value}</span>
            {delta != null && isFinite(delta) && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  tone
                )}
              >
                <Icon className="h-3 w-3" />
                {Math.abs(Math.round(delta))}%
              </span>
            )}
          </div>
        )}
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/30 p-10 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted-foreground" />}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-green-500/15 text-green-400 border-green-500/30",
    success: "bg-green-500/15 text-green-400 border-green-500/30",
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    captured: "bg-green-500/15 text-green-400 border-green-500/30",
    paid: "bg-green-500/15 text-green-400 border-green-500/30",
    transcribing: "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse",
    uploading: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    processing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    exporting: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    created: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    past_due: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelled: "bg-muted text-muted-foreground border-border",
    canceled: "bg-muted text-muted-foreground border-border",
  };
  const cls = map[status?.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", cls)}>
      {status}
    </span>
  );
}

export function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function formatINR(paise: number): string {
  const rs = (paise ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rs);
}
