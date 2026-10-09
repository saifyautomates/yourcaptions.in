// Full-screen loading overlay. Used as the Suspense fallback for lazy-loaded
// pages so route transitions have a polished, on-brand loading state instead
// of a blank screen. Renders the FuturisticLoader over a blurred backdrop.
// Optional `error` + `onRetry` props render a recoverable error state in the
// same shell — used by auth guards when session hydration fails.

import { AlertTriangle, RotateCw } from "lucide-react";
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
          <div className="flex flex-col items-center gap-5">
            {/* Ambient Aura Glow */}
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute w-28 h-28 rounded-full bg-[#E60000]/25 blur-2xl pointer-events-none"
                animate={{ scale: [0.85, 1.25, 0.85], opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Logo Badge Icon */}
              <motion.div 
                className="relative w-16 h-16 rounded-[14px] bg-[#050505] flex items-center justify-center shadow-[0_0_35px_rgba(230,0,0,0.55)] overflow-hidden shrink-0 border border-white/15"
                animate={{ scale: [0.97, 1.03, 0.97] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Rotating Conic Border */}
                <motion.div 
                  className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_320deg,rgba(230,0,0,0.85)_340deg,rgba(255,255,255,0.95)_360deg)]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-[2px] bg-[#0A0A0A] rounded-[12px] z-0" />
                
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 z-10 pointer-events-none"
                  animate={{ y: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                />
                <span className="text-white font-black text-[32px] leading-none absolute left-[8px] z-10 font-inter tracking-tighter">Y</span>
                <span className="text-[#E60000] font-black text-[32px] leading-none absolute left-[24px] font-inter z-0">C</span>
                <div className="absolute right-[6px] top-[18px] flex flex-col gap-[3px] items-start z-10">
                  <div className="w-[14px] h-[2.5px] bg-white rounded-full"></div>
                  <div className="w-[18px] h-[2.5px] bg-white rounded-full"></div>
                  <div className="flex items-center gap-[2.5px]">
                    <div className="w-[10px] h-[2.5px] bg-white rounded-full"></div>
                    <motion.div 
                      className="w-[4px] h-[4px] bg-[#E60000] rounded-full shadow-[0_0_8px_#E60000]"
                      animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Brand Title */}
            <div className="flex items-center font-inter font-bold text-[24px] sm:text-[26px] tracking-tight">
              <span className="text-white">Your</span>
              <span className="text-[#E60000]">captions</span>
              <span className="text-white">.in</span>
            </div>

            {/* Subtle animated neon loader bar */}
            <div className="w-24 h-[2.5px] bg-white/10 rounded-full overflow-hidden relative mt-1">
              <motion.div 
                className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-[#E60000] to-transparent"
                animate={{ x: [-40, 100] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* Show custom label if specific message passed, otherwise clean logo */}
            {label && label !== "Loading" && label !== "Loading..." && (
              <p className="text-xs text-[#AAA] font-medium tracking-wide mt-1">
                {label}
              </p>
            )}

            {hint && (
              <p className="text-xs text-[#777] font-medium tracking-wide">
                {hint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LoadingOverlay;

