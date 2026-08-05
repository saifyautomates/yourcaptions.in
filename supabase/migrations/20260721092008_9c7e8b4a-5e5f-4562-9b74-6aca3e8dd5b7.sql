
-- 1) consume_quota: remove admin unlimited bypass; treat admin as studio plan
CREATE OR REPLACE FUNCTION public.consume_quota(_user_id uuid, _kind meter_kind, _amount bigint)
 RETURNS TABLE(used bigint, quota bigint, remaining bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan   public.plan_tier;
  v_quota  bigint;
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_new    bigint;
BEGIN
  IF _user_id IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  SELECT plan INTO v_plan FROM public.profiles WHERE id = _user_id;
  IF v_plan IS NULL THEN v_plan := 'starter'; END IF;
  IF public.has_role(_user_id, 'admin') THEN v_plan := 'studio'; END IF;

  v_quota := public.plan_quota(v_plan, _kind);
  IF v_quota IS NULL THEN
    RAISE EXCEPTION 'no quota for plan/kind' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.usage_meters AS um (user_id, kind, period_start, used)
  VALUES (_user_id, _kind, v_period, _amount)
  ON CONFLICT (user_id, kind, period_start)
    DO UPDATE SET used = um.used + EXCLUDED.used
  RETURNING um.used INTO v_new;

  IF v_new > v_quota THEN
    UPDATE public.usage_meters
       SET used = usage_meters.used - _amount
     WHERE user_id = _user_id AND kind = _kind AND period_start = v_period;
    RAISE EXCEPTION 'quota_exceeded:%:%/%', _kind, v_new, v_quota USING ERRCODE = 'P0002';
  END IF;

  used := v_new;
  quota := v_quota;
  remaining := v_quota - v_new;
  RETURN NEXT;
END;
$function$;

-- 2) my_usage: admins use studio quotas, not unlimited
CREATE OR REPLACE FUNCTION public.my_usage()
 RETURNS TABLE(kind meter_kind, used bigint, quota bigint, remaining bigint, period_start date)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_plan   public.plan_tier;
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  k        public.meter_kind;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
  IF v_plan IS NULL THEN v_plan := 'starter'; END IF;
  IF public.has_role(v_uid, 'admin') THEN v_plan := 'studio'; END IF;

  FOREACH k IN ARRAY ARRAY['caption_seconds','dub_seconds','export_count']::public.meter_kind[]
  LOOP
    kind := k;
    quota := public.plan_quota(v_plan, k);
    SELECT COALESCE(um.used, 0) INTO used
      FROM public.usage_meters um
     WHERE um.user_id = v_uid AND um.kind = k AND um.period_start = v_period;
    IF used IS NULL THEN used := 0; END IF;
    remaining := GREATEST(0, quota - used);
    period_start := v_period;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 3) check_and_record_usage: admin no longer bypasses rate limits
CREATE OR REPLACE FUNCTION public.check_and_record_usage(_user_id uuid, _function text, _per_minute integer, _per_hour integer, _per_day integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_min int; c_hr int; c_day int;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
    count(*) FILTER (WHERE created_at > now() - interval '1 hour'),
    count(*) FILTER (WHERE created_at > now() - interval '1 day')
  INTO c_min, c_hr, c_day
  FROM public.usage_events
  WHERE user_id = _user_id
    AND function_name = _function
    AND created_at > now() - interval '1 day';

  IF c_min >= _per_minute THEN
    RAISE EXCEPTION 'rate_limit:minute:%/%', c_min, _per_minute USING ERRCODE = 'P0001';
  END IF;
  IF c_hr >= _per_hour THEN
    RAISE EXCEPTION 'rate_limit:hour:%/%', c_hr, _per_hour USING ERRCODE = 'P0001';
  END IF;
  IF c_day >= _per_day THEN
    RAISE EXCEPTION 'rate_limit:day:%/%', c_day, _per_day USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.usage_events (user_id, function_name) VALUES (_user_id, _function);
END;
$function$;

-- 4) deduct_credits: no admin bypass — deduct like everyone else
CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _amount numeric, _reference_type text DEFAULT NULL::text, _reference_id uuid DEFAULT NULL::uuid, _metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w public.credit_wallets%rowtype;
  from_plan numeric := 0;
  from_topup numeric := 0;
  remaining numeric;
  new_balance numeric;
  v_tx uuid;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF (w.plan_credits + w.topup_credits) < _amount THEN
    RAISE EXCEPTION 'insufficient_credits:%/%', (w.plan_credits + w.topup_credits), _amount
      USING ERRCODE = 'P0002';
  END IF;

  from_plan := LEAST(w.plan_credits, _amount);
  remaining := _amount - from_plan;
  from_topup := remaining;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits - from_plan,
         topup_credits = topup_credits - from_topup,
         updated_at = now()
   WHERE user_id = _user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  new_balance := w.plan_credits + w.topup_credits;
  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
  VALUES (_user_id, 'deduct', _amount, new_balance, _reference_type, _reference_id,
          COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('from_plan', from_plan, 'from_topup', from_topup),
          'completed')
  RETURNING id INTO v_tx;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := new_balance; tx_id := v_tx;
  RETURN NEXT;
END;
$function$;

-- 5) reserve_credits: no admin bypass
CREATE OR REPLACE FUNCTION public.reserve_credits(p_user_id uuid, p_amount numeric, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w public.credit_wallets%rowtype;
  v_from_plan numeric := 0;
  v_from_topup numeric := 0;
  v_txn_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF (w.plan_credits + w.topup_credits) < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0002';
  END IF;

  v_from_plan := LEAST(w.plan_credits, p_amount);
  v_from_topup := p_amount - v_from_plan;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits - v_from_plan,
         topup_credits = topup_credits - v_from_topup,
         updated_at = now()
   WHERE user_id = p_user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (p_user_id, 'deduct', p_amount, w.plan_credits + w.topup_credits, p_reference_id, p_reference_type, 'reserved',
          COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('from_plan', v_from_plan, 'from_topup', v_from_topup))
  RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$function$;

-- 6) Upgrade every current admin to the Studio plan and grant Studio monthly credits
DO $$
DECLARE
  r record;
  v_monthly numeric;
BEGIN
  SELECT monthly_credits INTO v_monthly FROM public.plan_limits WHERE plan = 'studio' LIMIT 1;
  IF v_monthly IS NULL THEN v_monthly := 0; END IF;

  FOR r IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  LOOP
    UPDATE public.profiles
       SET plan = 'studio', updated_at = now()
     WHERE id = r.user_id AND (plan IS DISTINCT FROM 'studio');

    INSERT INTO public.credit_wallets(user_id) VALUES (r.user_id)
      ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.credit_wallets
       SET plan_credits = GREATEST(plan_credits, v_monthly),
           plan_credits_reset_at = now(),
           updated_at = now()
     WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 7) When a new admin role is granted, auto-upgrade their plan to studio
CREATE OR REPLACE FUNCTION public.on_admin_role_granted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_monthly numeric;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT monthly_credits INTO v_monthly FROM public.plan_limits WHERE plan = 'studio' LIMIT 1;
    IF v_monthly IS NULL THEN v_monthly := 0; END IF;

    UPDATE public.profiles SET plan = 'studio', updated_at = now()
     WHERE id = NEW.user_id AND (plan IS DISTINCT FROM 'studio');

    INSERT INTO public.credit_wallets(user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.credit_wallets
       SET plan_credits = GREATEST(plan_credits, v_monthly),
           plan_credits_reset_at = now(),
           updated_at = now()
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_on_admin_role_granted ON public.user_roles;
CREATE TRIGGER trg_on_admin_role_granted
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.on_admin_role_granted();
