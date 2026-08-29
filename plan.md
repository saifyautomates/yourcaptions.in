# Razorpay Webhook & Atomic Settlement Implementation Plan

## 1. Database Migrations

### A. New Table: `webhook_events`
To guarantee event-level idempotency, we will create a `webhook_events` table:
```sql
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- e.g., 'razorpay'
  event_id text NOT NULL, -- e.g., 'ev_xxx'
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
-- Service role only access
GRANT ALL ON public.webhook_events TO service_role;
```

### B. New RPC: `settle_payment_atomic`
We will create a PL/pgSQL function to atomically transition a payment to a settled state, apply credits/subscriptions, and record the webhook event, preventing race conditions.

```sql
CREATE OR REPLACE FUNCTION public.settle_payment_atomic(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_expected_amount integer,
  p_expected_currency text,
  p_webhook_event_id text,
  p_webhook_event_type text,
  p_settle_type text -- 'topup' or 'plan'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation details:
-- 1. Check idempotency in webhook_events.
-- 2. SELECT ... FOR UPDATE on payments where razorpay_order_id = p_razorpay_order_id
-- 3. Verify payment amounts/currency.
-- 4. If topup: extract pack, determine credits, add_credits('topup'), update payment to 'credited'
-- 5. If plan: extract plan/billing, update subscription, update profile, add_credits('plan'), update payment to 'paid'
-- 6. Insert into webhook_events.
-- 7. Return success or failure JSON.
$$;
```

## 2. RPC Changes
- We will replace the separate `verify-razorpay-payment` database calls with a single call to `settle_payment_atomic`.
- We will rely on `add_credits` (which handles `credit_wallets` and `credit_transactions`) and `plan_limits` as the authoritative source of truth for credit amounts, instead of blindly trusting client/webhook payloads.

## 3. Webhook Edge Function
- **Path:** `supabase/functions/razorpay-webhook/index.ts`
- **Responsibilities:**
  - Verify HMAC-SHA256 signature using `Deno.env.get('RAZORPAY_WEBHOOK_SECRET')`.
  - Process events: `payment.captured` and `order.paid`.
  - Extract `x-razorpay-event-id`.
  - Look up internal payment record using the Razorpay `order_id` from the payload.
  - Call `settle_payment_atomic` to safely allocate credits and mark as paid.
  - Handle errors securely (return non-200 for retryable failures like DB connection issues, return 200 for ignored events/already processed).

## 4. Frontend Verification Changes
- **Path:** `supabase/functions/verify-razorpay-payment/index.ts`
- **Changes:**
  - Instead of running multiple separate `.update` and `.insert` queries (which is race-prone), it will call `settle_payment_atomic` with a null `webhook_event_id`.
  - This ensures that if the webhook and frontend hit the server at the same time, the `SELECT ... FOR UPDATE` lock in `settle_payment_atomic` ensures exactly one succeeds and the other receives an 'already_settled' idempotent response without duplicating credits.

## 5. Subscription Handling
- `settle_payment_atomic` will upsert into `subscriptions` matching on `user_id` and `plan` or by creating a new subscription record if none exists.
- Renewal dates will be safely calculated server-side based on `plan_pricing` (or `annual`/`monthly` billing strings).

## 6. Rollback Behavior
- Because everything inside `settle_payment_atomic` runs in a single PL/pgSQL function block, any `RAISE EXCEPTION` will automatically abort and ROLLBACK the entire database transaction.
- If credit allocation fails, the `payments` status will remain unchanged, ensuring no entitlement is lost.

## 7. Test Plan
We will write a comprehensive test script (`test-razorpay-settlement.ts`) covering:
1. Webhook Signature validation (valid vs invalid).
2. Webhook Idempotency (calling webhook twice with same event ID).
3. Concurrent Verification (calling `verify-razorpay-payment` and webhook simultaneously).
4. Amount validation (webhook reporting tampered amount).
5. State isolation (payment status safely marked 'paid' and exactly the correct amount of credits added to `credit_wallets`).
