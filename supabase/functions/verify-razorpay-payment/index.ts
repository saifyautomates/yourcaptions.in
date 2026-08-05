import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("unauthorized");

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const expected = createHmac("sha256", KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) throw new Error("signature mismatch");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load the pending payment row. This is the ONLY source of truth for what
    // the user paid for — never trust the client's kind/pack/plan.
    const { data: payRow } = await admin
      .from("payments")
      .select("id, status, user_id, amount_paise, plan")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (!payRow || payRow.user_id !== userData.user.id) throw new Error("order not found");
    if (payRow.status === "paid" || payRow.status === "credited") {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storedStatus: string = payRow.status ?? "";
    const isTopup = storedStatus.startsWith("created:topup:");

    if (isTopup) {
      const pack = storedStatus.split(":")[2] ?? "";
      
      const { data: topupCfg } = await admin.from('plan_pricing').select('*').eq('plan_id', 'topup').eq('billing_cycle', pack).single();
      if (!topupCfg) throw new Error("invalid pack");

      if (payRow.amount_paise !== topupCfg.price_inr_paise) throw new Error("amount mismatch");

      const secondsToAdd = topupCfg.credits_seconds || 0;

      // Atomic increment — avoids read-then-write race when two top-ups verify concurrently.
      const { error: incErr } = await admin.rpc("increment_credits_seconds", {
        target_user: userData.user.id,
        add_seconds: secondsToAdd,
      });
      if (incErr) throw incErr;

      await admin.from("payments").update({
        razorpay_payment_id, status: "credited",
      }).eq("razorpay_order_id", razorpay_order_id);

      return new Response(JSON.stringify({ ok: true, added_seconds: secondsToAdd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plan upgrade path
    const plan = payRow.plan as string | null;
    let billing = "monthly";
    if (storedStatus.startsWith("created:plan:annual")) billing = "annual";
    else if (storedStatus.startsWith("created:plan:monthly")) billing = "monthly";
    
    if (!plan) throw new Error("invalid plan");

    const { data: planCfg } = await admin.from('plan_pricing').select('*').eq('plan_id', plan).eq('billing_cycle', billing).single();
    if (!planCfg) throw new Error("invalid plan configuration");

    if (payRow.amount_paise !== planCfg.price_inr_paise) throw new Error("amount mismatch");

    await admin.from("payments").update({
      razorpay_payment_id, status: "paid",
    }).eq("razorpay_order_id", razorpay_order_id);

    const periodDays = billing === "annual" ? 365 : 30;
    const creditsToAssign = planCfg.credits_seconds || 0;

    await admin.from("subscriptions").insert({
      user_id: userData.user.id, plan, status: "active",
      current_period_end: new Date(Date.now() + periodDays * 24 * 3600 * 1000).toISOString(),
    });

    await admin.from("profiles").update({
      plan, credits_seconds: creditsToAssign,
    }).eq("id", userData.user.id);
    
    await admin.from("credit_wallets").upsert({
      user_id: userData.user.id,
      plan_credits: creditsToAssign,
      plan_credits_reset_at: new Date(Date.now() + periodDays * 24 * 3600 * 1000).toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
