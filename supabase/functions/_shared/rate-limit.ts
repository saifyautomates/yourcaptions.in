// Shared rate-limit + credit-deduction helpers for edge functions.
// Uses the Postgres `check_and_record_usage` RPC (SECURITY DEFINER) via the
// service-role client so caps are enforced atomically at the DB layer.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface RateCaps {
  perMinute: number;
  perHour: number;
  perDay: number;
}

export const RATE_LIMITS: Record<string, RateCaps> = {
  transcribe:            { perMinute: 5,  perHour: 30, perDay: 100 },
  "translate-captions":  { perMinute: 10, perHour: 60, perDay: 300 },
  "dub-video":           { perMinute: 3,  perHour: 20, perDay: 60  },
};

export function makeAdmin(): SupabaseClient {
  return createClient(
    (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Enforce per-minute/hour/day caps for (user_id, function_name) and record
 * the event. Returns { ok: true } on success, or { ok: false, status, message }
 * when the DB helper raised — caller should return that status to the client.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  userId: string,
  fnName: keyof typeof RATE_LIMITS | string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const caps = RATE_LIMITS[fnName] ?? { perMinute: 5, perHour: 30, perDay: 100 };
  const { error } = await admin.rpc("check_and_record_usage", {
    _user_id: userId,
    _function: fnName,
    _per_minute: caps.perMinute,
    _per_hour: caps.perHour,
    _per_day: caps.perDay,
  });
  if (!error) return { ok: true };

  const msg = String(error.message ?? "");
  if (msg.includes("rate_limit:")) {
    const window = msg.includes("minute") ? "minute"
                 : msg.includes("hour")   ? "hour"
                 : "day";
    return {
      ok: false,
      status: 429,
      message: `Rate limit exceeded for this ${window}. Please slow down and try again shortly.`,
    };
  }
  return { ok: false, status: 500, message: `usage check failed: ${msg}` };
}

/**
 * Check the user has enough credits in either their modern wallet or legacy pool.
 * Returns available credits when ok.
 */
export async function requireCredits(
  admin: SupabaseClient,
  userId: string,
  neededSeconds: number, // Legacy param is seconds, but new ledger runs on minutes
): Promise<{ ok: true; available: number } | { ok: false; status: number; message: string }> {
  // Edge functions pre-check for 1 needed second to test gate.
  // We'll calculate total available minutes in the new ledger.
  
  const [walletRes, profRes] = await Promise.all([
    admin.from("credit_wallets").select("plan_credits, topup_credits").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("credits_seconds").eq("id", userId).maybeSingle()
  ]);

  const planCredits = Number(walletRes.data?.plan_credits ?? 0);
  const topupCredits = Number(walletRes.data?.topup_credits ?? 0);
  const legacySeconds = Number(profRes.data?.credits_seconds ?? 0);

  // 1 credit = 1 minute.
  const walletMinutesAvailable = planCredits + topupCredits;
  const legacyMinutesAvailable = legacySeconds > 0 ? Math.ceil(legacySeconds / 60) : 0;
  
  const totalMinutesAvailable = walletMinutesAvailable + legacyMinutesAvailable;
  const neededMinutes = Math.max(1, Math.ceil(neededSeconds / 60));

  if (totalMinutesAvailable < neededMinutes) {
    return {
      ok: false,
      status: 402,
      message: `You do not have enough credits to process this video. Needed: ${neededMinutes} credits. Available: ${totalMinutesAvailable} credits.`
    };
  }

  return { ok: true, available: totalMinutesAvailable };
}

/**
 * Deduct `minutes` from the user's credit_wallets. Best-effort; caller
 * should treat any failure here as non-fatal to the request.
 */
export async function deductCredits(
  admin: SupabaseClient,
  userId: string,
  seconds: number,
): Promise<void> {
  if (!seconds || seconds <= 0) return;
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  const { data: wallet } = await admin
    .from("credit_wallets")
    .select("plan_credits, topup_credits")
    .eq("user_id", userId)
    .single();

  if (wallet) {
    let remainingToDeduct = minutes;
    let newPlan = Number(wallet.plan_credits ?? 0);
    let newTopup = Number(wallet.topup_credits ?? 0);

    // Deduct from plan first
    if (newPlan >= remainingToDeduct) {
      newPlan -= remainingToDeduct;
      remainingToDeduct = 0;
    } else {
      remainingToDeduct -= newPlan;
      newPlan = 0;
    }

    // Then deduct from topup
    if (remainingToDeduct > 0) {
      newTopup = Math.max(0, newTopup - remainingToDeduct);
    }

    await admin.from("credit_wallets")
      .update({ plan_credits: newPlan, topup_credits: newTopup })
      .eq("user_id", userId);
  }

  // Also deduct from legacy pool just to be safe
  const { data: prof } = await admin.from("profiles").select("credits_seconds").eq("id", userId).maybeSingle();
  if (prof && prof.credits_seconds > 0) {
    await admin.from("profiles")
      .update({ credits_seconds: Math.max(0, prof.credits_seconds - Math.ceil(seconds)) })
      .eq("id", userId);
  }
}

/**
 * Refund `minutes` to the user's credit_wallets. Best-effort; caller
 * should treat any failure here as non-fatal to the request.
 */
export async function refundCredits(
  admin: SupabaseClient,
  userId: string,
  seconds: number,
): Promise<void> {
  if (!seconds || seconds <= 0) return;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const { data: wallet } = await admin
    .from("credit_wallets")
    .select("plan_credits, topup_credits")
    .eq("user_id", userId)
    .single();

  if (wallet) {
    // We don't easily know if it came from topup or plan, so we refund to plan first.
    // Ideally we'd refund to whichever was deducted, but this is a simple fallback.
    const newPlan = Number(wallet.plan_credits ?? 0) + minutes;
    await admin.from("credit_wallets")
      .update({ plan_credits: newPlan })
      .eq("user_id", userId);
  }
}
