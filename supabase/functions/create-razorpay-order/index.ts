import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Full plan upgrades (subscription-style).
// Keys will be matched as `${plan}_${billing}` (e.g. creator_monthly)
const PLANS: Record<string, { amount: number }> = {
  creator_monthly: { amount: 79900 },
  creator_yearly: { amount: 699000 },
  studio_monthly: { amount: 199900 },
  studio_yearly: { amount: 1799000 },
};

const TOPUPS: Record<string, { amount: number; seconds: number; label: string }> = {
  topup_small:  { amount: 29900,  seconds: 30 * 60,      label: "30 minutes" },
  topup_medium: { amount: 99900,  seconds: 2 * 60 * 60,  label: "2 hours"    },
  topup_large:  { amount: 399900, seconds: 10 * 60 * 60, label: "10 hours"   },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) throw new Error("Razorpay keys not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("unauthorized");

    const supabase = createClient(
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("unauthorized");

    const body = await req.json();
    const kind: "plan" | "topup" = body.kind === "topup" ? "topup" : "plan";

    let amount: number;
    const notes: Record<string, string> = { user_id: userData.user.id, kind };
    let planForRow: string | null = null;
    let packForRow: string | null = null;

    if (kind === "topup") {
      const pack = String(body.pack ?? "");
      const cfg = TOPUPS[pack];
      if (!cfg) throw new Error("invalid pack");
      amount = cfg.amount;
      notes.pack = pack;
      notes.seconds = String(cfg.seconds);
      packForRow = pack;
    } else {
      const plan = String(body.plan ?? "");
      const billing = String(body.billing ?? "monthly");
      const planKey = `${plan}_${billing}`;
      const cfg = PLANS[planKey];
      if (!cfg) throw new Error("invalid plan or billing");
      amount = cfg.amount;
      notes.plan = plan;
      notes.billing = billing;
      // We will store plan in the database row, maybe we should also store billing
      // Since `plan` column is limited, we can encode billing into `status`.
      planForRow = plan;
    }

    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`);
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount, currency: "INR",
        receipt: `r_${userData.user.id.slice(0, 12)}_${Date.now()}`,
        notes,
      }),
    });
    if (!orderRes.ok) throw new Error(`Razorpay: ${await orderRes.text()}`);
    const order = await orderRes.json();

    const admin = createClient((Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("payments").insert({
      user_id: userData.user.id,
      razorpay_order_id: order.id,
      amount_paise: amount,
      // For top-ups we leave plan null and encode the pack in the row via a
      // synthetic status prefix so verification can look it up without a new column.
      plan: planForRow as any,
      status: kind === "topup" ? `created:topup:${packForRow}` : `created:plan:${notes.billing}`,
    });

    return new Response(JSON.stringify({
      order_id: order.id, amount, key_id: KEY_ID, kind,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
