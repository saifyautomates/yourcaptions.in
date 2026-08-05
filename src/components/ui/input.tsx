import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[10px] border border-[var(--border-3)] bg-[var(--bg-5)] px-4 py-2 text-sm text-[var(--text-2)] transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-[var(--text-6)]",
          "focus-visible:outline-none focus-visible:border-[var(--red-3)] focus-visible:shadow-[0_0_0_3px_rgba(230,0,0,0.12)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[var(--error)] focus-visible:border-[var(--error)] focus-visible:shadow-[0_0_0_3px_rgba(230,0,0,0.12)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
