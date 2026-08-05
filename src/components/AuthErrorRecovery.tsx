import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Mail, KeyRound, UserPlus, Wifi, LifeBuoy, ChevronDown, ChevronUp, LogOut, LayoutDashboard, ShieldAlert, KeySquare, Link2Off } from "lucide-react";
import { newAuthRequestId, logAuthError, logAuthSuccess, type LoggedAuthError, type RecoveryAction, type AuthErrorCategory } from "@/lib/authErrorLog";

const CATEGORY_STYLES: Record<AuthErrorCategory, { icon: JSX.Element; className: string }> = {
  jwt:            { icon: <KeySquare className="h-3 w-3" />,  className: "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300" },
  rls:            { icon: <ShieldAlert className="h-3 w-3" />, className: "bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300" },
  "stale-route":  { icon: <Link2Off className="h-3 w-3" />,   className: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300" },
  credentials:    { icon: <KeyRound className="h-3 w-3" />,   className: "bg-destructive/15 text-destructive border-destructive/40" },
  unconfirmed:    { icon: <Mail className="h-3 w-3" />,       className: "bg-violet-500/15 text-violet-700 border-violet-500/40 dark:text-violet-300" },
  "rate-limit":   { icon: <RefreshCw className="h-3 w-3" />,  className: "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-300" },
  network:        { icon: <Wifi className="h-3 w-3" />,       className: "bg-slate-500/15 text-slate-700 border-slate-500/40 dark:text-slate-300" },
  oauth:          { icon: <UserPlus className="h-3 w-3" />,   className: "bg-green-500/15 text-green-700 border-green-500/40 dark:text-green-300" },
  unknown:        { icon: <AlertTriangle className="h-3 w-3" />, className: "bg-muted text-muted-foreground border-border" },
};

function CategoryBadge({ category, label }: { category: AuthErrorCategory; label: string }) {
  const s = CATEGORY_STYLES[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-medium ${s.className}`}
      title={`Failure category: ${category}`}
    >
      {s.icon}
      {label}
    </span>
  );
}

interface Props {
  error: LoggedAuthError;
  email?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  onTryGoogle?: () => void;
}

/**
 * Inline recovery panel. Explains the failure in plain language, exposes the
 * request ID for support, and offers contextual actions instead of leaving the
 * user in a loop (retry, reset password, resend confirmation, switch to Google,
 * check network, contact support).
 */
export function AuthErrorRecovery({ error, email, onRetry, onDismiss, onTryGoogle }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState<RecoveryAction | null>(null);

  const resendConfirmation = async () => {
    if (!email) return toast.error("Enter your email first");
    setBusy("resend-confirmation");
    const rid = newAuthRequestId();
    const { error: err } = await supabase.auth.resend({ type: "signup", email });
    setBusy(null);
    if (err) {
      logAuthError({ method: "password-signup", stage: "initiate", error: err, requestId: rid, context: { action: "resend" } });
      return toast.error(err.message, { description: `Request ID: ${rid}` });
    }
    logAuthSuccess("password-signup", "initiate", rid, { action: "resend" });
    toast.success("Confirmation email sent. Check your inbox.");
  };

  const actions: Record<RecoveryAction, { label: string; icon: JSX.Element; onClick: () => void; primary?: boolean }> = {
    retry: {
      label: "Try again",
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      onClick: () => { onDismiss?.(); onRetry?.(); },
      primary: true,
    },
    "reset-password": {
      label: "Reset password",
      icon: <KeyRound className="h-3.5 w-3.5" />,
      onClick: () => { window.location.href = `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`; },
    },
    "resend-confirmation": {
      label: busy === "resend-confirmation" ? "Sending…" : "Resend confirmation email",
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: () => void resendConfirmation(),
    },
    "try-google": {
      label: "Continue with Google",
      icon: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.83 3.4 14.65 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.93 0 9.5-4.86 9.5-9.36 0-.63-.06-1.11-.15-1.6H12z" />
        </svg>
      ),
      onClick: () => { onDismiss?.(); onTryGoogle?.(); },
    },
    "create-account": {
      label: "Create an account",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onClick: () => { window.location.href = `/signup${email ? `?email=${encodeURIComponent(email)}` : ""}`; },
    },
    "check-network": {
      label: "Check connection",
      icon: <Wifi className="h-3.5 w-3.5" />,
      onClick: () => window.open("https://www.google.com/", "_blank", "noopener"),
    },
    "wait-and-retry": {
      label: "Wait 30s and retry",
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      onClick: () => {
        toast.info("We'll retry in 30 seconds.");
        setTimeout(() => { onDismiss?.(); onRetry?.(); }, 30_000);
      },
    },
    "clear-session": {
      label: busy === "clear-session" ? "Clearing…" : "Clear session & retry",
      icon: <LogOut className="h-3.5 w-3.5" />,
      onClick: async () => {
        setBusy("clear-session");
        try {
          await supabase.auth.signOut().catch(() => {});
          // Purge any stale sb-* tokens that survived signOut
          Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
          toast.success("Session cleared. Please sign in again.");
        } finally {
          setBusy(null);
          onDismiss?.();
          onRetry?.();
        }
      },
      primary: true,
    },
    "go-dashboard": {
      label: "Back to dashboard",
      icon: <LayoutDashboard className="h-3.5 w-3.5" />,
      onClick: () => { window.location.href = "/dashboard"; },
    },
    "contact-support": {
      label: "Contact support",
      icon: <LifeBuoy className="h-3.5 w-3.5" />,
      onClick: () => {
        const body = encodeURIComponent(
          `I'm hitting a sign-in issue.\n\nRequest ID: ${error.requestId}\nCategory: ${error.categoryLabel} (${error.category})\nMessage: ${error.friendly}\nStatus: ${error.status ?? "—"}\nCode: ${error.code ?? "—"}`,
        );
        window.location.href = `mailto:support@Yourcaptions.in?subject=${encodeURIComponent("Sign-in issue " + error.requestId)}&body=${body}`;
      },
    },
  };

  const copyRid = async () => {
    try { await navigator.clipboard.writeText(error.requestId); toast.success("Request ID copied"); }
    catch { toast.error("Copy failed"); }
  };

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">We couldn't sign you in</span>
                <CategoryBadge category={error.category} label={error.categoryLabel} />
              </div>
              <div className="mt-0.5 break-words text-destructive/90">{error.friendly}</div>
            </div>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 rounded px-1 text-[11px] text-destructive/70 hover:text-destructive"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {error.recovery.map((k) => {
              const a = actions[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={a.onClick}
                  disabled={busy === k}
                  className={
                    a.primary
                      ? "inline-flex items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:opacity-60"
                      : "inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  }
                >
                  {a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-destructive/80">
            <button type="button" onClick={copyRid} className="underline-offset-2 hover:underline" title="Copy request ID">
              req: {error.requestId}
            </button>
            {error.status != null && <span>status: {error.status}</span>}
            {error.code && <span>code: {error.code}</span>}
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/30 px-1.5 py-0.5 text-[10.5px] hover:bg-destructive/10"
            >
              {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showRaw ? "Hide details" : "Technical details"}
            </button>
          </div>

          {showRaw && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-snug text-foreground/80">
{JSON.stringify(error.raw, Object.getOwnPropertyNames(error.raw ?? {}), 2)}
            </pre>
          )}

          <div className="mt-2 text-[11px] text-destructive/70">
            Still stuck?{" "}
            <Link to="/forgot-password" className="underline underline-offset-2">Reset your password</Link>
            {" "}or email support with the request ID above.
          </div>
        </div>
      </div>
    </div>
  );
}
