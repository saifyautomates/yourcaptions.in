import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--bg-5)] shimmer", className)}
      {...props}
    />
  );
}

export { Skeleton };

export function CreditBalanceSkeleton() {
  return <Skeleton className="h-8 w-24 rounded-full" />;
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-[var(--bg-3)] border border-[var(--border-2)] rounded-[16px] overflow-hidden">
      <div className="aspect-video bg-[var(--bg-5)] shimmer" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function CaptionListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <Skeleton className="h-5 w-16 shrink-0" />
          <Skeleton className="h-10 flex-1" />
        </div>
      ))}
    </div>
  );
}
