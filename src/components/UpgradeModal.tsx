// Focused upgrade modal shown when a user clicks "Upgrade plan" from any
// disabled action. Presents a side-by-side plan comparison with billing
// toggle and a one-click checkout via Razorpay — no page navigation needed.

import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, X, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PLANS } from "@/lib/plans";
import { BRAND_PRIMARY_HEX } from "@/lib/brand";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window { Razorpay: any }
}

const loadRazorpay = () => new Promise<boolean>((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => res(true); s.onerror = () => res(false);
  document.body.appendChild(s);
});

export function UpgradeModal({
  open,
  onOpenChange,
  action,
  hint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action?: string;
  hint?: string;
}) {
  const { user } = useAuth();
  const { balance, planCredits, topupCredits } = useCredits();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (planId: string) => {
    if (!user) { onOpenChange(false); navigate("/signin"); return; }
    setBusy(planId);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load Razorpay");
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: { plan: planId, billing: yearly ? "annual" : "monthly" },
      });
      if (error) throw error;
      const rp = new window.Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: "INR",
        name: "Yourcaptions.in",
        description: `${planId} plan`,
        prefill: { email: user.email },
        theme: { color: BRAND_PRIMARY_HEX },
        handler: async (resp: any) => {
          const { error: vErr } = await supabase.functions.invoke("verify-razorpay-payment", {
            body: {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              plan: planId,
            },
          });
          if (vErr) return toast.error("Verification failed");
          toast.success("Payment successful — plan upgraded");
          onOpenChange(false);
        },
      });
      rp.open();
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-4 w-4 text-primary" />
                {action ? `Upgrade to unlock ${action}` : "Upgrade your plan"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {hint ?? "You're out of credits — pick a plan to restore access instantly."}
                {" "}
                <span className="text-foreground/80">
                  Balance: <span className="font-semibold tabular-nums">{balance.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">
                    (Plan {planCredits.toLocaleString()} · Top-up {topupCredits.toLocaleString()})
                  </span>
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-none items-center gap-1 rounded-full border border-border bg-background/70 p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                !yearly ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                yearly ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                2 mo free
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const price = yearly ? Math.round(p.yearly / 12) : p.monthly;
            const strike = yearly ? Math.round(p.yearlyStrike / 12) : p.monthlyStrike;
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-5 ${
                  p.popular
                    ? "border-primary/50 bg-card/80 shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_20px_60px_-20px_hsl(var(--primary)/0.35)]"
                    : "border-border bg-card/50"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Most popular
                  </div>
                )}
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary/70">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">₹{price}</span>
                  <span className="text-sm text-muted-foreground line-through">₹{strike}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  / month {p.gstNote && <span>+ 18% GST</span>}
                </p>

                <button
                  disabled={busy === p.id}
                  onClick={() => buy(p.id)}
                  className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    p.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-transparent text-foreground hover:border-primary/50"
                  }`}
                >
                  {busy === p.id ? "Loading…" : `Upgrade to ${p.name.replace(" Plan", "")}`}
                </button>

                <div className="my-4 h-px w-full bg-border/70" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {p.featuresHeader}
                </p>
                <ul className="mt-3 space-y-2 text-[12px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-3.5 w-3.5 flex-none place-items-center rounded-full bg-primary/20">
                        <Check className="h-2 w-2 text-primary" strokeWidth={3} />
                      </span>
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/60 px-6 py-3 text-[11px] text-muted-foreground">
          <span>Secure payment via Razorpay · Cancel anytime</span>
          <Link
            to="/pricing"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Compare full plans <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
