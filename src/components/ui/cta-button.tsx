import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap " +
  "transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 aria-busy:cursor-progress";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_0_0_0_hsl(var(--primary)/0)] " +
    "hover:shadow-[0_0_40px_-8px_hsl(var(--primary)/0.7)] hover:scale-[1.03] " +
    "active:shadow-[0_0_20px_-10px_hsl(var(--primary)/0.6)]",
  secondary:
    "border border-border bg-card/40 text-foreground backdrop-blur " +
    "hover:border-primary/50 hover:bg-card hover:text-foreground",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm sm:text-[15px]",
  lg: "h-12 px-7 text-sm sm:h-[52px] sm:px-8 sm:text-[15px]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    as?: "button";
  };

type AnchorProps = CommonProps &
  Omit<LinkProps, "children" | "className"> & {
    as: "link";
  };

type ExternalProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    as: "a";
    href: string;
  };

export type CtaButtonProps = ButtonProps | AnchorProps | ExternalProps;

/**
 * Shared CTA with consistent hover / focus / active / disabled / loading states.
 * Renders as a <button>, a react-router <Link>, or an external <a>.
 */
export const CtaButton = forwardRef<HTMLElement, CtaButtonProps>((props, ref) => {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    className,
    children,
  } = props;

  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-90")}>{children}</span>
    </>
  );

  if ("as" in props && props.as === "link") {
    const { variant: _v, size: _s, loading: _l, fullWidth: _f, className: _c, children: _ch, as: _a, ...rest } = props;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        aria-busy={loading || undefined}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  if ("as" in props && props.as === "a") {
    const { variant: _v, size: _s, loading: _l, fullWidth: _f, className: _c, children: _ch, as: _a, ...rest } = props;
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        aria-busy={loading || undefined}
        {...rest}
      >
        {content}
      </a>
    );
  }

  const {
    variant: _v,
    size: _s,
    loading: _l,
    fullWidth: _f,
    className: _c,
    children: _ch,
    as: _a,
    disabled,
    type = "button",
    ...rest
  } = props as ButtonProps;

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

CtaButton.displayName = "CtaButton";
