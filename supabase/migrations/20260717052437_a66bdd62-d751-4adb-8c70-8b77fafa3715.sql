-- Monthly quota metering per user per feature.
CREATE TYPE public.meter_kind AS ENUM ('caption_seconds', 'dub_seconds', 'export_count');

CREATE TABLE public.usage_meters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         public.meter_kind NOT NULL,
  period_start date NOT NULL,   -- first day of the billing month (UTC)
  used         bigint NOT NULL DEFAULT 0 CHECK (used >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_start)
);

CREATE INDEX usage_meters_user_period_idx ON public.usage_meters (user_id, period_start DESC);

GRANT SELECT ON public.usage_meters TO authenticated;
GRANT ALL    ON public.usage_meters TO service_role;

ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage meters"
  ON public.usage_meters
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_usage_meters_updated_at
  BEFORE UPDATE ON public.usage_meters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Returns the monthly limit for a (plan, kind). Editable in one place.
CREATE OR REPLACE FUNCTION public.plan_quota(_plan public.plan_tier, _kind public.meter_kind)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'starter' THEN CASE _kind
      WHEN 'caption_seconds' THEN 1800::bigint     -- 30 min
      WHEN 'dub_seconds'     THEN 600::bigint      -- 10 min
      WHEN 'export_count'    THEN 5::bigint
    END
    WHEN 'creator' THEN CASE _kind
      WHEN 'caption_seconds' THEN 18000::bigint    -- 5 hr
      WHEN 'dub_seconds'     THEN 7200::bigint     -- 2 hr
      WHEN 'export_count'    THEN 50::bigint
    END
    WHEN 'studio' THEN CASE _kind
      WHEN 'caption_seconds' THEN 108000::bigint   -- 30 hr
      WHEN 'dub_seconds'     THEN 36000::bigint    -- 10 hr
      WHEN 'export_count'    THEN 500::bigint
    END
  END
$$;

-- Atomic quota check + consume. Raises SQLSTATE 'P0002' with prefix
-- 'quota_exceeded' when the user's plan cap for this feature would be
-- exceeded this month.
CREATE OR REPLACE FUNCTION public.consume_quota(
  _user_id uuid,
  _kind    public.meter_kind,
  _amount  bigint
)
RETURNS TABLE (used bigint, quota bigint, remaining bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Upsert the meter row for this period and add usage atomically.
  INSERT INTO public.usage_meters (user_id, kind, period_start, used)
  VALUES (_user_id, _kind, v_period, _amount)
  ON CONFLICT (user_id, kind, period_start)
    DO UPDATE SET used = public.usage_meters.used + EXCLUDED.used
  RETURNING public.usage_meters.used INTO v_new;

  IF v_new > v_quota THEN
    -- Roll back the addition and signal quota exceeded.
    UPDATE public.usage_meters
       SET used = used - _amount
     WHERE user_id = _user_id AND kind = _kind AND period_start = v_period;
    RAISE EXCEPTION 'quota_exceeded:%:%/%', _kind, v_new, v_quota USING ERRCODE = 'P0002';
  END IF;

  used := v_new;
  quota := v_quota;
  remaining := v_quota - v_new;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_quota(uuid, public.meter_kind, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, public.meter_kind, bigint) TO service_role;

-- Read-only view for the client's usage widget.
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
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;