import { createClient } from "@supabase/supabase-js";
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
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
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

    const admin = createClient(
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the payment row first to know the amount and currency to pass to the RPC
    const { data: payRow } = await admin
      .from("payments")
      .select("user_id, amount_paise, currency")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    if (!payRow || payRow.user_id !== userData.user.id) throw new Error("order not found");

    // Delegate settlement to atomic RPC
    // We pass null for webhook_event_id because this is client-side verification
    const { data: settleResult, error: settleError } = await admin.rpc("settle_payment_atomic", {
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_razorpay_amount: payRow.amount_paise,
      p_razorpay_currency: payRow.currency,
      p_webhook_event_id: null,
      p_webhook_event_type: null
    });

    if (settleError) {
      console.error("RPC Error:", settleError);
      throw settleError;
    }

    return new Response(JSON.stringify(settleResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
