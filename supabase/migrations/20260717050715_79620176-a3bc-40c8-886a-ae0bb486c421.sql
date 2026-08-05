
CREATE TABLE public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  cost_units integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_fn_time_idx
  ON public.usage_events (user_id, function_name, created_at DESC);

GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage"
  ON public.usage_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Enforce per-minute, per-hour, per-day caps and record the event.
-- Raises exception with SQLSTATE 'P0001' when a limit is exceeded.
CREATE OR REPLACE FUNCTION public.check_and_record_usage(
  _user_id uuid,
  _function text,
  _per_minute int,
  _per_hour int,
  _per_day int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min int;
  c_hr int;
  c_day int;
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
$$;

REVOKE ALL ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) TO service_role;
