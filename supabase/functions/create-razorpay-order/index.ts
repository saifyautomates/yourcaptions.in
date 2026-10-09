import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Full plan upgrades (subscription-style).
// Keys will be matched as `${plan}_${billing}` (e.g. creator_monthly)
const PLANS: Record<string, { amount: number }> = {
  editor_monthly: { amount: 49900 },
  editor_yearly: { amount: 499200 },
  editor_annual: { amount: 499200 },
  creator_monthly: { amount: 99900 },
  creator_yearly: { amount: 999600 },
  creator_annual: { amount: 999600 },
  studio_monthly: { amount: 259900 },
  studio_yearly: { amount: 2599200 },
  studio_annual: { amount: 2599200 },
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
    
    // Default billing handling
    let billing = "monthly";

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
      billing = String(body.billing ?? "monthly");
      // Normalize to 'yearly' for consistent DB status
      if (billing === "annual") billing = "yearly";

      const planKey = `${plan}_${billing}`;
      const cfg = PLANS[planKey];
      
      if (!cfg) throw new Error("invalid plan or billing");
      
      amount = cfg.amount;
      notes.plan = plan;
      notes.billing = billing;
      
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
      plan: planForRow as any,
      status: kind === "topup" ? `created:topup:${packForRow}` : `created:plan:${billing}`,
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
