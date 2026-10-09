-- 1. Webhook Events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.webhook_events TO service_role;

-- 2. Plan Limits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    CREATE TYPE public.plan_tier AS ENUM ('starter', 'editor', 'creator', 'studio');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan               text PRIMARY KEY,
  display_name       text NOT NULL,
  monthly_credits    numeric NOT NULL DEFAULT 30,
  max_video_minutes  numeric NOT NULL DEFAULT 10,
  max_file_size_mb   integer NOT NULL DEFAULT 250,
  storage_gb         integer NOT NULL DEFAULT 5,
  max_team_members   integer NOT NULL DEFAULT 1,
  can_export_srt     boolean NOT NULL DEFAULT true,
  can_burn_captions  boolean NOT NULL DEFAULT false,
  can_dub            boolean NOT NULL DEFAULT false,
  can_clone_voice    boolean NOT NULL DEFAULT false,
  can_lip_sync       boolean NOT NULL DEFAULT false,
  can_generate_video boolean NOT NULL DEFAULT false,
  can_use_api        boolean NOT NULL DEFAULT false,
  can_audio_only_upload boolean NOT NULL DEFAULT false,
  can_green_screen   boolean NOT NULL DEFAULT false,
  watermark_forced   boolean NOT NULL DEFAULT true,
  max_export_resolution text NOT NULL DEFAULT '720p',
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_limits_public_read" ON public.plan_limits FOR SELECT USING (true);
GRANT SELECT ON public.plan_limits TO anon, authenticated;
GRANT ALL ON public.plan_limits TO service_role;

INSERT INTO public.plan_limits (plan, display_name, monthly_credits, max_video_minutes, max_file_size_mb, max_export_resolution, watermark_forced)
VALUES
  ('starter', 'Starter', 5, 2, 250, '720p', true),
  ('editor',  'Editor', 120, 30, 1000, '1080p', false),
  ('creator', 'Creator', 300, 60, 2000, '4k', false),
  ('studio',  'Studio', 720, 120, 5000, '4k', false)
ON CONFLICT (plan) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_credits = EXCLUDED.monthly_credits,
  max_video_minutes = EXCLUDED.max_video_minutes,
  max_file_size_mb = EXCLUDED.max_file_size_mb,
  max_export_resolution = EXCLUDED.max_export_resolution,
  watermark_forced = EXCLUDED.watermark_forced;

-- 3. Plan Pricing
CREATE TABLE IF NOT EXISTS public.plan_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  monthly_price numeric NOT NULL,
  yearly_price numeric NOT NULL,
  yearly_total numeric NOT NULL,
  original_monthly numeric,
  original_yearly numeric,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan, currency)
);

ALTER TABLE public.plan_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_pricing_public_read" ON public.plan_pricing FOR SELECT USING (true);
GRANT SELECT ON public.plan_pricing TO anon, authenticated;
GRANT ALL ON public.plan_pricing TO service_role;

INSERT INTO public.plan_pricing (plan, currency, monthly_price, yearly_price, yearly_total, original_monthly, original_yearly)
VALUES
  ('editor',  'INR', 499,  416,  4992,  699,  558),
  ('creator', 'INR', 999,  833,  9996,  1499, 1042),
  ('studio',  'INR', 2599, 2166, 25992, 3499, 2900)
ON CONFLICT (plan, currency) DO UPDATE SET
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  yearly_total = EXCLUDED.yearly_total;

-- 4. Topup Pricing
CREATE TABLE IF NOT EXISTS public.topup_pricing (
  pack text PRIMARY KEY,
  currency text NOT NULL DEFAULT 'INR',
  price numeric NOT NULL,
  credits_seconds numeric NOT NULL,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.topup_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topup_pricing_public_read" ON public.topup_pricing FOR SELECT USING (true);
GRANT SELECT ON public.topup_pricing TO anon, authenticated;
GRANT ALL ON public.topup_pricing TO service_role;

INSERT INTO public.topup_pricing (pack, currency, price, credits_seconds)
VALUES
  ('topup_small', 'INR', 299, 1800),
  ('topup_medium', 'INR', 999, 7200),
  ('topup_large', 'INR', 3999, 36000)
ON CONFLICT (pack) DO NOTHING;

-- 5. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_public_read" ON public.system_settings FOR SELECT USING (true);
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- 6. Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  feature_name text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  enabled_global boolean NOT NULL DEFAULT true,
  enabled_plans text[] DEFAULT '{}',
  is_beta boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_public_read" ON public.feature_flags FOR SELECT USING (true);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- 7. SETTLE PAYMENT ATOMIC RPC
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
  v_status text;
  v_plan text;
  v_billing text := 'monthly';
  v_is_topup boolean := false;
  v_user_id uuid;
BEGIN
  -- 1. Idempotency Check for Webhooks
  IF p_webhook_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM webhook_events WHERE provider = 'razorpay' AND event_id = p_webhook_event_id) THEN
      RETURN jsonb_build_object('ok', true, 'status', 'already_processed', 'event_id', p_webhook_event_id);
    END IF;
  END IF;

  -- 2. Lock & Fetch Payment Row
  SELECT * INTO v_payment
  FROM payments
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_razorpay_order_id;
  END IF;

  v_user_id := v_payment.user_id;

  -- If already paid, return idempotent success
  IF v_payment.status = 'paid' OR v_payment.status = 'settled' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_settled', 'order_id', p_razorpay_order_id);
  END IF;

  -- 3. Parse Status (plan vs topup)
  IF v_payment.status LIKE 'created:topup:%' THEN
    v_is_topup := true;
  ELSIF v_payment.status LIKE 'created:plan:%' THEN
    v_billing := split_part(v_payment.status, ':', 3);
  END IF;

  v_plan := COALESCE(v_payment.plan, 'editor');

  -- 4. Mark Payment Row as Paid
  UPDATE payments SET
    status = 'paid',
    razorpay_payment_id = p_razorpay_payment_id,
    amount_paise = p_razorpay_amount,
    currency = COALESCE(p_razorpay_currency, 'INR'),
    updated_at = now()
  WHERE razorpay_order_id = p_razorpay_order_id;

  -- 5. Update User Profile & Subscription
  IF NOT v_is_topup THEN
    UPDATE profiles SET
      subscription_tier = v_plan,
      subscription_status = 'active',
      updated_at = now()
    WHERE id = v_user_id;

    -- Upsert Subscriptions
    INSERT INTO subscriptions (
      user_id,
      plan,
      status,
      current_period_end,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_plan,
      'active',
      now() + (CASE WHEN v_billing IN ('yearly', 'annual') THEN interval '1 year' ELSE interval '1 month' END),
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();
  END IF;

  -- 6. Record Webhook Idempotency Event
  IF p_webhook_event_id IS NOT NULL THEN
    INSERT INTO webhook_events (provider, event_id, event_type, status)
    VALUES ('razorpay', p_webhook_event_id, COALESCE(p_webhook_event_type, 'payment.captured'), 'processed')
    ON CONFLICT (provider, event_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'settled',
    'user_id', v_user_id,
    'plan', v_plan,
    'billing', v_billing,
    'is_topup', v_is_topup
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_payment_atomic(text, text, numeric, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
