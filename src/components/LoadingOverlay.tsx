// Full-screen loading overlay. Used as the Suspense fallback for lazy-loaded
// pages so route transitions have a polished, on-brand loading state instead
// of a blank screen. Renders the FuturisticLoader over a blurred backdrop.
// Optional `error` + `onRetry` props render a recoverable error state in the
// same shell — used by auth guards when session hydration fails.

import { AlertTriangle, RotateCw } from "lucide-react";
import { FuturisticLoader } from "./FuturisticLoader";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface Props {
  /** Optional short label shown under the loader. */
  label?: string;
  /** Secondary line — e.g. "Still checking your session…" after a slow load. */
  hint?: string;
  /** Renders inline within a parent instead of fixed to the viewport. */
  contained?: boolean;
  /** When set, replaces the spinner with an error message + retry button. */
  error?: Error | string | null;
  /** Callback for the retry button. */
  onRetry?: () => void;
}

export function LoadingOverlay({ label = "Loading", hint, contained, error, onRetry }: Props) {
  const errMsg = error instanceof Error ? error.message : error;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        contained ? "absolute" : "fixed",
        "inset-0 z-[9999] flex items-center justify-center",
        "bg-background/70 backdrop-blur-sm",
        "animate-in fade-in duration-200",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, hsl(var(--primary) / 0.18) 0%, transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(circle at 50% 50%, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, black 20%, transparent 70%)",
        }}
      />
      <div className="relative flex max-w-md flex-col items-center gap-6 px-6 text-center">
        {errMsg ? (
          <>
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
            <div className="text-base font-semibold">{label === "Loading" ? "Couldn't reach the auth server" : label}</div>
            <p className="text-sm text-muted-foreground">
              {errMsg}. Check your connection and try again.
            </p>
            <div className="flex gap-2">
              {onRetry && (
                <Button onClick={onRetry} size="sm" className="gap-2">
                  <RotateCw className="h-4 w-4" /> Retry
                </Button>
              )}
              <Button onClick={() => window.location.reload()} size="sm" variant="outline">
                Reload page
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <FuturisticLoader size="xl" />
              <motion.div 
                className="absolute inset-0 rounded-full border border-primary/20"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/80">
                {label}
                <span className="ml-0.5 inline-flex">
                  <span style={{ animation: "flg-dot 1.4s ease-in-out infinite" }}>.</span>
                  <span style={{ animation: "flg-dot 1.4s ease-in-out 0.2s infinite" }}>.</span>
                  <span style={{ animation: "flg-dot 1.4s ease-in-out 0.4s infinite" }}>.</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoadingOverlay;

