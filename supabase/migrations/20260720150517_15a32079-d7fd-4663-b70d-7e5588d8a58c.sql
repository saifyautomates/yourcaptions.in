
-- Admins bypass all quota limits (unlimited transcribe/dub/export)
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

  -- Admins: unlimited, still track usage for visibility
  IF public.has_role(_user_id, 'admin') THEN
    INSERT INTO public.usage_meters AS um (user_id, kind, period_start, used)
    VALUES (_user_id, _kind, v_period, _amount)
    ON CONFLICT (user_id, kind, period_start)
      DO UPDATE SET used = um.used + EXCLUDED.used
    RETURNING um.used INTO v_new;
    used := v_new;
    quota := 9223372036854775807;
    remaining := quota - v_new;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT plan INTO v_plan FROM public.profiles WHERE id = _user_id;
  IF v_plan IS NULL THEN v_plan := 'starter'; END IF;

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
  v_admin  boolean;
  k        public.meter_kind;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_admin := public.has_role(v_uid, 'admin');
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
  IF v_plan IS NULL THEN v_plan := 'starter'; END IF;

  FOREACH k IN ARRAY ARRAY['caption_seconds','dub_seconds','export_count']::public.meter_kind[]
  LOOP
    kind := k;
    quota := CASE WHEN v_admin THEN 9223372036854775807 ELSE public.plan_quota(v_plan, k) END;
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

-- Also bypass rate limits for admins
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

  IF public.has_role(_user_id, 'admin') THEN
    INSERT INTO public.usage_events (user_id, function_name) VALUES (_user_id, _function);
    RETURN;
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
