// Current plan + billing renewal info for the wallet UI. Reads the profile's
// plan tier and the latest active subscription's current_period_end. Falls
// back to credit_wallets.plan_credits_reset_at + 1 month when no external
// subscription record exists (e.g. legacy / manual grants).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PLAN_LABEL: Record<string, string> = {
  starter: "Free",
  editor: "Editor",
  creator: "Creator",
  studio: "Studio",
};

export interface PlanInfo {
  loading: boolean;
  planId: string;         // raw ('starter' | 'editor' | 'creator' | 'studio')
  planName: string;       // human label
  renewsAt: Date | null;  // next replenishment / billing renewal
  status: string | null;  // subscription status if any
  isPaid: boolean;
}

export function usePlanInfo(): PlanInfo {
  const { user } = useAuth();
  const [state, setState] = useState<PlanInfo>({
    loading: true, planId: "starter", planName: "Free", renewsAt: null, status: null, isPaid: false,
  });

  useEffect(() => {
    if (!user) { setState({ loading: false, planId: "starter", planName: "Free", renewsAt: null, status: null, isPaid: false }); return; }
    let cancelled = false;

    const load = async () => {
      const [{ data: prof }, { data: sub }, { data: wallet }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan, status, current_period_end")
          .eq("user_id", user.id).order("current_period_end", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("credit_wallets").select("plan_credits_reset_at").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      const planId = (sub?.plan as string) ?? (prof?.plan as string) ?? "starter";
      let renewsAt: Date | null = null;
      if (sub?.current_period_end) {
        renewsAt = new Date(sub.current_period_end as string);
      } else if (wallet?.plan_credits_reset_at) {
        const last = new Date(wallet.plan_credits_reset_at as string);
        const next = new Date(last);
        next.setMonth(next.getMonth() + 1);
        renewsAt = next;
      }
      setState({
        loading: false,
        planId,
        planName: PLAN_LABEL[planId] ?? planId,
        renewsAt,
        status: (sub?.status as string) ?? null,
        isPaid: planId !== "starter",
      });
    };
    load();

    return () => { cancelled = true; };
  }, [user]);

  return state;
}
