import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--bg-6)] text-[var(--text-1)] hover:bg-[var(--bg-7)]",
        secondary:
          "border-transparent bg-[var(--bg-5)] text-[var(--text-2)] hover:bg-[var(--bg-6)]",
        destructive:
          "border-transparent bg-[var(--error)] text-white hover:bg-[var(--error)]/80",
        outline: "text-[var(--text-3)] border-[var(--border-3)]",
        success: "border-transparent bg-[var(--success)]/10 text-[var(--success)]",
        warning: "border-transparent bg-[var(--warning)]/10 text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

function Badge({ className, variant, pulse, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), pulse && "animate-pulse", className)} {...props} />
  );
}

export { Badge, badgeVariants };
