// One-time onboarding modal shown after signup. Asks for use-case (optional)
// then marks profiles.onboarding_dismissed_at so it never returns.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";

const USE_CASES = [
  { id: "shorts", label: "Short-form (Reels / TikTok / Shorts)" },
  { id: "podcast", label: "Podcast clips" },
  { id: "youtube", label: "YouTube long-form" },
  { id: "translation", label: "Translation & dubbing" },
  { id: "other", label: "Other" },
];

export const OnboardingModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_dismissed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data && !data.onboarding_dismissed_at) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dismiss = async (useCase: string | null) => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        onboarding_dismissed_at: new Date().toISOString(),
        ...(useCase ? { onboarding_use_case: useCase } : {}),
      })
      .eq("id", user.id);
    setSaving(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(choice); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>Welcome — what will you use captions for?</DialogTitle>
          <DialogDescription>
            Optional. We'll suggest the best templates for your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-2">
          {USE_CASES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChoice(c.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                choice === c.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:border-primary/40 hover:bg-secondary/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => dismiss(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <Button onClick={() => dismiss(choice)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
