// First-run checklist: shows Upload → Pick template → Export as a 3-step card
// for new users. Persists dismissal in profiles.onboarding_dismissed_at so it
// disappears forever once completed. Purely presentational — reads existing
// state (project count + export count) that the dashboard already fetches.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, X, Upload, Palette, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  /** How many projects the user already has (0 = fresh account). */
  projectCount: number;
}

/**
 * Rules:
 *  - Show only if the user has never dismissed AND has < 1 export.
 *  - Step 1 (Upload) ticks once they have ≥ 1 project.
 *  - Step 2 (Pick template) ticks once they have ≥ 1 project (opening a project auto-picks a preset).
 *  - Step 3 (Export) ticks once export_count > 0 for the current period.
 *  - Auto-dismisses (writes onboarding_dismissed_at) the moment all three are done.
 */
export function FirstRunChecklist({ projectCount }: Props) {
  const { user } = useAuth();
  
  const [exportsUsed, setExportsUsed] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [profRes, walletRes] = await Promise.all([
        supabase.from("profiles").select("onboarding_dismissed_at").eq("id", user.id).maybeSingle(),
        supabase.from("credit_wallets").select("export_count_used").eq("user_id", user.id).maybeSingle()
      ]);
      if (!cancelled) {
         setDismissedAt((profRes.data as any)?.onboarding_dismissed_at ?? null);
         setExportsUsed((walletRes.data as any)?.export_count_used ?? 0);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const step1 = projectCount >= 1;
  const step2 = projectCount >= 1;
  const step3 = exportsUsed >= 1;
  const allDone = step1 && step2 && step3;

  // Auto-persist dismissal once everything's done — no user action needed.
  useEffect(() => {
    if (!user || !allDone || dismissedAt) return;
    void supabase
      .from("profiles")
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [allDone, dismissedAt, user]);

  const dismiss = async () => {
    if (!user) return;
    setDismissedAt(new Date().toISOString());
    await supabase
      .from("profiles")
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq("id", user.id);
  };

  // Loading, already dismissed, or user has already exported once — hide.
  if (dismissedAt === undefined) return null;
  if (dismissedAt) return null;
  if (exportsUsed >= 1) return null;

  const steps = [
    { done: step1, icon: Upload, title: "Upload your first video", hint: "MP4 or MOV, up to 1 GB." },
    { done: step2, icon: Palette, title: "Pick a caption template", hint: "50+ styles — Hormozi, MrBeast, Neon Glow, 3D Depth & more." },
    { done: step3, icon: Download, title: "Export & download", hint: "One click to 1080p or 4K MP4." },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section
      aria-label="Get started checklist"
      className="mt-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/30 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 border-b border-primary/20 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <h2 className="text-xs font-semibold">Get started in 3 quick steps</h2>
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
            {doneCount}/{steps.length}
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="h-0.5 w-full bg-secondary/50" aria-hidden="true">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="grid gap-2 p-3 sm:grid-cols-3">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <li
              key={s.title}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                s.done
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card/40"
              }`}
            >
              <span className="mt-[1px] flex-none">
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Completed" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  <StepIcon className="h-3 w-3 text-primary" aria-hidden="true" />
                  Step {i + 1} · {s.title}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{s.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {!allDone && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-3 py-2 text-[10px] text-muted-foreground">
          <span>Tip: drop a clip into the upload area above to knock out step 1.</span>
          <Link to="/pricing" className="font-medium text-primary hover:underline">
            See plans →
          </Link>
        </div>
      )}
    </section>
  );
}

export default FirstRunChecklist;
