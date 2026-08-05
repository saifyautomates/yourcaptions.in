import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subscribeRateLimit, type RateLimitEvent } from "@/lib/rateLimit";

const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m ${sec}s`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const fmtMinutes = (secs: number) => {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)} min`;
  return `${(secs / 3600).toFixed(1)} h`;
};

export function CreditsBanner() {
  const { user } = useAuth();
  const [creditsSeconds, setCreditsSeconds] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("starter");
  const [limit, setLimit] = useState<RateLimitEvent | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Load + realtime profile
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("credits_seconds, plan")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted || !data) return;
      setCreditsSeconds((data as any).credits_seconds ?? 0);
      setPlan((data as any).plan ?? "starter");
    })();

    const ch = supabase
      .channel(`profile-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (p: any) => {
          if (typeof p.new?.credits_seconds === "number") setCreditsSeconds(p.new.credits_seconds);
          if (typeof p.new?.plan === "string") setPlan(p.new.plan);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      try { ch.unsubscribe(); } catch { /* noop */ }
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Subscribe to rate-limit events
  useEffect(() => subscribeRateLimit((e) => setLimit(e)), []);

  // Tick countdown
  useEffect(() => {
    if (!limit) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [limit]);

  useEffect(() => {
    if (limit && now >= limit.endsAt) setLimit(null);
  }, [now, limit]);

  if (creditsSeconds == null) return null;

  const remainingMs = limit ? limit.endsAt - now : 0;
  const lowCredits = creditsSeconds < 60;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b px-4 py-1.5 text-xs ${
        limit
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : lowCredits
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-border/60 bg-card/40 text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Zap className={`h-3.5 w-3.5 ${lowCredits ? "text-primary" : ""}`} />
        <span className="font-semibold uppercase tracking-wider text-[10px]">Credits</span>
        <span className={`font-semibold tabular-nums ${lowCredits ? "text-primary" : "text-foreground"}`}>
          {fmtMinutes(creditsSeconds)}
        </span>
        <span className="rounded-full border border-border bg-card/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {plan}
        </span>
      </div>

      {lowCredits && !limit && (
        <span className="text-muted-foreground">
          Low balance —{" "}
          <Link to="/pricing" className="font-semibold text-primary underline-offset-2 hover:underline">
            top up
          </Link>
        </span>
      )}

      {limit && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Rate limit · per {limit.window}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-mono text-[11px]">
            <Clock className="h-3 w-3" /> {fmtCountdown(remainingMs)}
          </span>
          <span className="hidden text-[11px] opacity-80 md:inline">
            {limit.fn ? `${limit.fn} cooling down` : "cooling down"} — try again shortly
          </span>
        </div>
      )}
    </div>
  );
}

export default CreditsBanner;
