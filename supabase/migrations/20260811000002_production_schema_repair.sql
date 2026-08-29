-- 20260811000002_production_schema_repair.sql
-- SAFE FORWARD-ONLY SCHEMA REPAIR
-- Configures schemas required by Edge Functions and Admin Panel
-- without destroying existing production structures or data.

-- 1. Webhook Events (Idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- 2. Alter Existing plan_limits (Do NOT drop or recreate)
ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS max_file_size_mb integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS storage_gb integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS can_clone_voice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_lip_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_generate_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_use_api boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_audio_only_upload boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_green_screen boolean NOT NULL DEFAULT false;

-- Safely backfill display names for existing enum values if null
UPDATE public.plan_limits SET display_name = 'Starter' WHERE plan = 'starter' AND display_name IS NULL;
UPDATE public.plan_limits SET display_name = 'Creator' WHERE plan = 'creator' AND display_name IS NULL;
UPDATE public.plan_limits SET display_name = 'Studio' WHERE plan = 'studio' AND display_name IS NULL;

-- 3. plan_pricing (Canonical schema matching src/pages/public/Pricing.tsx)
CREATE TABLE IF NOT EXISTS public.plan_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan public.plan_tier NOT NULL REFERENCES public.plan_limits(plan),
  currency text NOT NULL DEFAULT 'INR',
  monthly_price numeric NOT NULL,
  yearly_price numeric NOT NULL,
  yearly_total numeric NOT NULL,
  original_monthly numeric,
  original_yearly numeric,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(plan, currency)
);

-- 4. topup_pricing (Explicit separate architecture for Top-ups)
CREATE TABLE IF NOT EXISTS public.topup_pricing (
  pack text PRIMARY KEY,
  currency text NOT NULL DEFAULT 'INR',
  price numeric NOT NULL,
  credits_seconds numeric NOT NULL,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 5. system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 6. feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  feature_name text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  enabled_global boolean NOT NULL DEFAULT true,
  enabled_plans text[] DEFAULT '{}',
  is_beta boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 7. admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ========================================================
-- RLS AND GRANTS MATRIX
-- ========================================================

-- webhook_events (Strictly private)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.webhook_events TO service_role;
REVOKE ALL ON public.webhook_events FROM anon, authenticated;

-- admin_audit_log (Admin read-only, Service Role write)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin" ON public.admin_audit_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
REVOKE ALL ON public.admin_audit_log FROM anon;

-- plan_pricing (Public read)
ALTER TABLE public.plan_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_pricing_read" ON public.plan_pricing FOR SELECT USING (true);
CREATE POLICY "plan_pricing_admin" ON public.plan_pricing FOR ALL USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.plan_pricing TO anon, authenticated;
GRANT ALL ON public.plan_pricing TO service_role;

-- topup_pricing (Public read)
ALTER TABLE public.topup_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topup_pricing_read" ON public.topup_pricing FOR SELECT USING (true);
CREATE POLICY "topup_pricing_admin" ON public.topup_pricing FOR ALL USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.topup_pricing TO anon, authenticated;
GRANT ALL ON public.topup_pricing TO service_role;

-- system_settings (Public read for globals like maintenance mode)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_read" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "system_settings_admin" ON public.system_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- feature_flags (Public read)
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags_admin" ON public.feature_flags FOR ALL USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- ========================================================
-- SEED PRICING DATA (Based on create-razorpay-order)
-- ========================================================

INSERT INTO public.plan_pricing (plan, currency, monthly_price, yearly_price, yearly_total, original_monthly, original_yearly) VALUES
  ('creator', 'INR', 799, 582.5, 6990, 1250, 1042),
  ('studio', 'INR', 1999, 1499, 17990, 3400, 2833)
ON CONFLICT (plan, currency) DO NOTHING;

INSERT INTO public.topup_pricing (pack, currency, price, credits_seconds) VALUES
  ('topup_small', 'INR', 299, 1800),
  ('topup_medium', 'INR', 999, 7200),
  ('topup_large', 'INR', 3999, 36000)
ON CONFLICT (pack) DO NOTHING;

-- ========================================================
-- SETTLE PAYMENT ATOMIC RPC
-- ========================================================

CREATE OR REPLACE FUNCTION public.settle_payment_atomic(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_amount numeric,
  p_razorpay_currency text,
  p_webhook_event_id text DEFAULT NULL,
  p_webhook_event_type text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_is_topup boolean;
  v_pack text;
  v_plan public.plan_tier;
  v_billing text;
  v_credits_to_add numeric := 0;
  v_expected_paise numeric;
  v_topup_row record;
  v_pricing_row record;
  v_limits_row record;
BEGIN
  -- 1. Idempotency Guard (Webhook duplicates)
  IF p_webhook_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM webhook_events WHERE provider = 'razorpay' AND event_id = p_webhook_event_id) THEN
      RETURN jsonb_build_object('ok', true, 'already_processed', true, 'reason', 'webhook_event_exists');
    END IF;
  END IF;

  -- 2. Lock Payment Row (Prevents race conditions)
  SELECT * INTO v_payment 
  FROM payments 
  WHERE razorpay_order_id = p_razorpay_order_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Verify amount and currency passed from Razorpay match our internal record
  IF p_razorpay_amount != v_payment.amount_paise THEN RAISE EXCEPTION 'razorpay_amount_mismatch'; END IF;
  IF upper(p_razorpay_currency) != upper(v_payment.currency) THEN RAISE EXCEPTION 'razorpay_currency_mismatch'; END IF;

  IF v_payment.status = 'paid' OR v_payment.status = 'credited' THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'reason', 'payment_status_completed');
  END IF;

  v_is_topup := v_payment.status LIKE 'created:topup:%';

  IF v_is_topup THEN
    -- ==================================
    -- TOP-UP FULFILLMENT
    -- ==================================
    v_pack := split_part(v_payment.status, ':', 3);
    
    SELECT * INTO v_topup_row FROM topup_pricing WHERE pack = v_pack LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_pack_pricing'; END IF;

    v_expected_paise := v_topup_row.price * 100;
    IF v_payment.amount_paise != v_expected_paise THEN RAISE EXCEPTION 'amount_mismatch'; END IF;

    v_credits_to_add := v_topup_row.credits_seconds;

    -- SAFELY add to credit_wallets.topup_credits (Bypasses increment_credits_seconds)
    PERFORM public.add_credits(
      v_payment.user_id,
      v_credits_to_add,
      'topup',
      'topup_purchase',
      'payment',
      v_payment.id,
      jsonb_build_object('razorpay_order_id', p_razorpay_order_id, 'pack', v_pack)
    );

    UPDATE payments
    SET status = 'credited', razorpay_payment_id = p_razorpay_payment_id
    WHERE id = v_payment.id;

  ELSE
    -- ==================================
    -- PLAN FULFILLMENT
    -- ==================================
    v_plan := v_payment.plan::public.plan_tier;
    v_billing := split_part(v_payment.status, ':', 3); -- 'annual', 'yearly', or 'monthly'

    SELECT * INTO v_pricing_row FROM plan_pricing WHERE plan = v_plan AND currency = 'INR' LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_plan_pricing'; END IF;

    v_expected_paise := CASE WHEN v_billing IN ('annual', 'yearly') THEN (v_pricing_row.yearly_total * 100) ELSE (v_pricing_row.monthly_price * 100) END;
    IF v_payment.amount_paise != v_expected_paise THEN RAISE EXCEPTION 'amount_mismatch'; END IF;

    SELECT * INTO v_limits_row FROM plan_limits WHERE plan = v_plan LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_plan_limits'; END IF;

    v_credits_to_add := v_limits_row.monthly_credits;

    -- SAFELY add to credit_wallets.plan_credits
    PERFORM public.add_credits(
      v_payment.user_id,
      v_credits_to_add,
      'plan',
      'plan_grant',
      'payment',
      v_payment.id,
      jsonb_build_object('razorpay_order_id', p_razorpay_order_id, 'plan', v_plan, 'billing', v_billing)
    );

    -- Ensure plan credits reset in exactly 1 month (even for annual)
    UPDATE credit_wallets 
    SET plan_credits_reset_at = now() + interval '1 month' 
    WHERE user_id = v_payment.user_id;

    -- Upsert Subscription
    INSERT INTO subscriptions (user_id, plan, status, current_period_end)
    VALUES (
      v_payment.user_id,
      v_plan,
      'active',
      now() + CASE WHEN v_billing IN ('annual', 'yearly') THEN interval '365 days' ELSE interval '30 days' END
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();

    -- Update Profile plan AND credits_seconds so reset_plan_credits_cron knows the new monthly allowance
    UPDATE profiles
    SET plan = v_plan, credits_seconds = v_limits_row.monthly_credits, updated_at = now()
    WHERE id = v_payment.user_id;

    UPDATE payments
    SET status = 'paid', razorpay_payment_id = p_razorpay_payment_id
    WHERE id = v_payment.id;
  END IF;

  -- 3. Record Webhook
  IF p_webhook_event_id IS NOT NULL THEN
    INSERT INTO webhook_events (provider, event_id, event_type, status)
    VALUES ('razorpay', p_webhook_event_id, p_webhook_event_type, 'processed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'credits_added', v_credits_to_add);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payment_atomic(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_payment_atomic(text, text, numeric, text, text, text) TO service_role;
