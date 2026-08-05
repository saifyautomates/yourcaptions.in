import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red-3)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-[var(--red-3)] text-white hover:bg-[var(--red-4)] shadow-[0_0_0_0_rgba(230,0,0,0)] hover:shadow-[0_0_20px_rgba(230,0,0,0.3)] active:bg-[var(--red-5)] border border-transparent",
        destructive: "bg-[var(--error)] text-white hover:bg-[var(--error)]/90",
        outline: "border border-[var(--border-3)] bg-transparent hover:bg-white hover:text-black hover:border-white text-[var(--text-2)]",
        secondary: "bg-[var(--bg-5)] text-[var(--text-1)] hover:bg-[var(--bg-6)] border border-[var(--border-3)]",
        ghost: "hover:bg-[var(--bg-5)] text-[var(--text-4)] hover:text-[var(--text-1)]",
        link: "text-[var(--red-3)] underline-offset-4 hover:underline",
        brand: "bg-[var(--red-3)] text-white hover:bg-[var(--red-4)] shadow-red-sm",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-[12px] px-8 text-base",
        xl: "h-14 rounded-[14px] px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  magnetic?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, magnetic = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const magneticRef = React.useRef<HTMLButtonElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (!magnetic || !magneticRef.current) return;
      const rect = magneticRef.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80) {
        magneticRef.current.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
      }
    };

    const handleMouseLeave = () => {
      if (magneticRef.current) {
        magneticRef.current.style.transform = 'translate(0, 0)';
        magneticRef.current.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
      }
    };

    // Forward ref to both external and internal
    const setRefs = React.useCallback(
      (node: HTMLButtonElement) => {
        magneticRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLButtonElement>).current = node;
        }
      },
      [ref]
    );

    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={setRefs} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={setRefs}
        whileTap={{ scale: props.disabled || loading ? 1 : 0.97 }}
        onMouseMove={magnetic ? handleMouseMove : props.onMouseMove}
        onMouseLeave={magnetic ? handleMouseLeave : props.onMouseLeave}
        disabled={props.disabled || loading}
        {...(props as any)}
      >
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin w-5 h-5" />
          </span>
        ) : null}
        <span className={cn('flex items-center justify-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
