// Plan-based quota enforcement. Wraps the `consume_quota` Postgres function
// so edge functions can atomically check + record usage against the caller's
// monthly plan limit.

import { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

export type MeterKind = "caption_seconds" | "dub_seconds" | "export_count";

export interface QuotaResult {
  ok: true;
  used: number;
  quota: number;
  remaining: number;
}
export interface QuotaBlock {
  ok: false;
  status: 402;
  message: string;
  kind: MeterKind;
}

// Attempt to consume `amount` units. On block, returns a friendly 402 payload
// that includes the specific meter and how far over the user is.
export async function consumeQuota(
  admin: SupabaseClient,
  user_id: string,
  kind: MeterKind,
  amount: number,
): Promise<QuotaResult | QuotaBlock> {
  const { data, error } = await admin.rpc("consume_quota", {
    _user_id: user_id,
    _kind: kind,
    _amount: Math.max(0, Math.ceil(amount)),
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("quota_exceeded")) {
      // Format: quota_exceeded:<kind>:<new>/<quota>
      const parts = msg.split("quota_exceeded:")[1]?.split(":") ?? [];
      const [_k, ratio] = parts;
      return {
        ok: false, status: 402, kind,
        message: `Plan limit reached for ${kindLabel(kind)} this month (${ratio ?? "over cap"}). Upgrade your plan or wait for the next billing cycle.`,
      };
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, used: Number(row.used), quota: Number(row.quota), remaining: Number(row.remaining) };
}

// Peek remaining without consuming — used for pre-checks before expensive
// upstream calls (e.g. TTS/STT) so we don't burn provider credits if the
// user is already at their cap.
export async function peekRemaining(
  admin: SupabaseClient,
  user_id: string,
  kind: MeterKind,
): Promise<{ used: number; quota: number; remaining: number }> {
  const period = new Date();
  const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1))
    .toISOString().slice(0, 10);

  const [{ data: prof }, { data: meter }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", user_id).maybeSingle(),
    admin.from("usage_meters").select("used").eq("user_id", user_id).eq("kind", kind).eq("period_start", periodStart).maybeSingle(),
  ]);
  const plan = (prof?.plan ?? "starter") as "starter" | "creator" | "studio";
  const quota = QUOTAS[plan][kind];
  const used = Number(meter?.used ?? 0);
  return { used, quota, remaining: Math.max(0, quota - used) };
}

// Mirror of public.plan_quota — kept in sync so we can precheck without an
// extra round trip. If you change either side, update the other.
const QUOTAS: Record<"starter" | "creator" | "studio", Record<MeterKind, number>> = {
  starter: { caption_seconds: 1800,   dub_seconds: 600,   export_count: 5 },
  creator: { caption_seconds: 18000,  dub_seconds: 7200,  export_count: 50 },
  studio:  { caption_seconds: 108000, dub_seconds: 36000, export_count: 500 },
};

function kindLabel(k: MeterKind): string {
  return k === "caption_seconds" ? "caption generation"
       : k === "dub_seconds"     ? "AI voiceover"
       : "video exports";
}
