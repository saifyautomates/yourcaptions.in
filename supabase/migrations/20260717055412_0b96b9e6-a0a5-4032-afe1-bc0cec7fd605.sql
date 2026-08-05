
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
