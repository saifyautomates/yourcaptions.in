import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const KEY_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!KEY_SECRET) throw new Error("Webhook secret not configured");

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) throw new Error("Missing signature");

    const expected = createHmac("sha256", KEY_SECRET)
      .update(rawBody)
      .digest("hex");
      
    if (expected !== signature) {
      console.error("Signature mismatch:", { expected, signature });
      throw new Error("signature mismatch");
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const eventId = req.headers.get("x-razorpay-event-id") || payload.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    if (eventType !== "payment.captured" && eventType !== "order.paid") {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) throw new Error("Missing payment entity in webhook payload");

    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;
    const razorpayAmount = paymentEntity.amount;
    const razorpayCurrency = paymentEntity.currency;

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new Error("Missing order_id or payment_id");
    }

    const admin = createClient(
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Let the settlement RPC handle everything atomically.
    const { data: settleResult, error: settleError } = await admin.rpc("settle_payment_atomic", {
      p_razorpay_order_id: razorpayOrderId,
      p_razorpay_payment_id: razorpayPaymentId,
      p_razorpay_amount: razorpayAmount,
      p_razorpay_currency: razorpayCurrency,
      p_webhook_event_id: eventId,
      p_webhook_event_type: eventType
    });

    if (settleError) {
      console.error("RPC Error in webhook:", settleError);
      throw settleError; // Throws 500 so Razorpay retries
    }

    return new Response(JSON.stringify(settleResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Webhook Error:", e);
    // Transient DB failures or missing payments should return 500 for retries.
    // Client signature mismatch should probably be 400.
    const msg = e.message || String(e);
    const isPermanent = msg.includes("signature mismatch") || 
      msg.includes("razorpay_amount_mismatch") ||
      msg.includes("razorpay_currency_mismatch") ||
      msg.includes("amount_mismatch") ||
      msg.includes("order_not_found") ||
      msg.includes("invalid_plan") ||
      msg.includes("Missing");

    const status = isPermanent ? 400 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
