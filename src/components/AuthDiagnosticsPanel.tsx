import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthTrail, clearOAuthTrail, type OAuthTrailEntry } from "@/lib/oauthDebug";

/**
 * Floating Auth Diagnostics panel. Toggle with Shift+A.
 * Shows: current session, provider, expiry, and the last N sign-in
 * attempts + OAuth trail entries recorded via logOAuth().
 */
export function AuthDiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<OAuthTrailEntry[]>([]);
  const [session, setSession] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "A" || e.key === "a") && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTrail(getOAuthTrail());
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const id = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(id);
  }, [open, tick]);

  if (!open) return null;

  const copy = () => {
    navigator.clipboard.writeText(
      JSON.stringify({ session, trail }, null, 2),
    );
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[420px] max-h-[70vh] overflow-hidden rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label="Auth diagnostics"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Auth Diagnostics
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="rounded bg-secondary px-2 py-0.5 text-[11px] hover:bg-secondary/80"
          >
            Copy
          </button>
          <button
            onClick={() => { clearOAuthTrail(); setTrail([]); }}
            className="rounded bg-secondary px-2 py-0.5 text-[11px] hover:bg-secondary/80"
          >
            Clear
          </button>
          <button
            onClick={async () => {
              for (const key of Object.keys(localStorage)) {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                  localStorage.removeItem(key);
                }
              }
              await supabase.auth.signOut().catch(() => {});
              window.location.href = "/signin";
            }}
            className="rounded bg-destructive/20 text-destructive px-2 py-0.5 text-[11px] hover:bg-destructive/30"
            title="Reset Auth State"
          >
            Reset
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded bg-secondary px-2 py-0.5 text-[11px] hover:bg-secondary/80"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-[calc(70vh-40px)] overflow-y-auto px-3 py-2 text-[11px] leading-relaxed">
        <div className="mb-2">
          <div className="font-semibold text-foreground">Current session</div>
          {session ? (
            <div className="mt-1 space-y-0.5 rounded bg-secondary/40 p-2 font-mono">
              <div>user: {session.user?.email ?? session.user?.id}</div>
              <div>provider: {session.user?.app_metadata?.provider ?? "—"}</div>
              <div>
                expires:{" "}
                {session.expires_at
                  ? new Date(session.expires_at * 1000).toLocaleString()
                  : "—"}
              </div>
              <div>token: {(session.access_token ?? "").slice(0, 12)}…</div>
            </div>
          ) : (
            <div className="mt-1 rounded bg-secondary/40 p-2 font-mono text-muted-foreground">
              No session (signed out).
            </div>
          )}
        </div>

        <div className="mb-1 font-semibold text-foreground">
          Trail ({trail.length})
        </div>
        <div className="space-y-1">
          {trail.length === 0 && (
            <div className="text-muted-foreground">
              No auth events recorded yet. Attempt sign-in to populate.
            </div>
          )}
          {trail
            .slice()
            .reverse()
            .map((e, i) => (
              <div
                key={i}
                className="rounded bg-secondary/30 p-2 font-mono text-[10.5px]"
              >
                <div className="flex items-center justify-between">
                  <span className={stageColor(e.stage)}>{e.stage}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.t).toLocaleTimeString()}
                  </span>
                </div>
                {e.detail && (
                  <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">
                    {JSON.stringify(e.detail, null, 0)}
                  </pre>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function stageColor(stage: string) {
  if (stage.includes("error") || stage === "session-missing")
    return "text-red-400";
  if (stage === "session-created" || stage === "code-exchange-success")
    return "text-green-400";
  if (stage === "provider-redirect" || stage === "callback-return")
    return "text-amber-400";
  return "text-foreground";
}
