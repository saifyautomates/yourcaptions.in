import { createClient } from "@supabase/supabase-js";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials");
  process.exit(1);
}
const admin = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: webhookEvents, error: err1 } = await admin.from('webhook_events').select('id').limit(1);
  const { data: rpcCheck, error: err2 } = await admin.rpc('settle_payment_atomic', { p_razorpay_order_id: 'test', p_razorpay_payment_id: 'test', p_expected_amount: 1, p_expected_currency: 'INR', p_webhook_event_id: 'test', p_webhook_event_type: 'test' });
  
  console.log("webhook_events exists:", !err1 || err1.code !== '42P01');
  console.log("webhook_events error:", err1);
  console.log("settle_payment_atomic error:", err2?.message);
}
check();
