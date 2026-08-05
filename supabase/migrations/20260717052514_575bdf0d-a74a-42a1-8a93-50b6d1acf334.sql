-- my_usage() is a per-caller read; use SECURITY INVOKER so RLS on
-- usage_meters/profiles enforces access naturally.
CREATE OR REPLACE FUNCTION public.my_usage()
RETURNS TABLE (
  kind          public.meter_kind,
  used          bigint,
  quota         bigint,
  remaining     bigint,
  period_start  date
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_plan   public.plan_tier;
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  k        public.meter_kind;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT plan INTO v_plan FROM public.profiles WHERE id = v_uid;
  IF v_plan IS NULL THEN v_plan := 'starter'; END IF;

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
$$;

REVOKE ALL ON FUNCTION public.my_usage() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;

-- Re-assert that consume_quota is backend-only.
REVOKE ALL ON FUNCTION public.consume_quota(uuid, public.meter_kind, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, public.meter_kind, bigint) TO service_role;