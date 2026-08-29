
-- PLANS ENUM
CREATE TYPE public.plan_tier AS ENUM ('starter', 'creator', 'studio');
CREATE TYPE public.project_status AS ENUM ('uploading', 'processing', 'ready', 'failed');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  plan public.plan_tier NOT NULL DEFAULT 'starter',
  credits_seconds INTEGER NOT NULL DEFAULT 1800,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'hi',
  status public.project_status NOT NULL DEFAULT 'uploading',
  media_path TEXT,
  duration_seconds INTEGER,
  provider TEXT NOT NULL DEFAULT 'whisper',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX projects_user_idx ON public.projects(user_id, created_at DESC);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CAPTIONS
CREATE TABLE public.captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  srt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captions TO authenticated;
GRANT ALL ON public.captions TO service_role;
ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage captions for own projects" ON public.captions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
CREATE INDEX captions_project_idx ON public.captions(project_id);

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL,
  razorpay_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  plan public.plan_tier,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users read own media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
ALTER TABLE public.captions ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS compare_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS chosen_provider text;
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

REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM authenticated;
-- Persistent background job queue for long-running work (transcribe, dub, ...).
-- Progress is written to `progress` (0-100) + `message`, and the client
-- subscribes via Realtime for resumable UX after reconnect.

CREATE TYPE public.job_kind AS ENUM ('transcribe', 'dub', 'translate');
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

CREATE TABLE public.jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind        public.job_kind NOT NULL,
  status      public.job_status NOT NULL DEFAULT 'queued',
  progress    smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  message     text,
  input       jsonb NOT NULL DEFAULT '{}'::jsonb,
  result      jsonb,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_user_active_idx
  ON public.jobs (user_id, created_at DESC)
  WHERE status IN ('queued', 'running');
CREATE INDEX jobs_project_idx ON public.jobs (project_id, created_at DESC);

GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL    ON public.jobs TO service_role;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs. Inserts/updates are done by edge
-- functions using service_role, so no INSERT/UPDATE policies are needed.
CREATE POLICY "Users view own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Realtime so clients can resume subscriptions after reconnect.
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;-- Monthly quota metering per user per feature.
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

GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;-- my_usage() is a per-caller read; use SECURITY INVOKER so RLS on
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
-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see own roles" ON public.user_roles;
CREATE POLICY "Users can see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin read access to usage & profiles
DROP POLICY IF EXISTS "Admins can view all usage_events" ON public.usage_events;
CREATE POLICY "Admins can view all usage_events" ON public.usage_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all usage_meters" ON public.usage_meters;
CREATE POLICY "Admins can view all usage_meters" ON public.usage_meters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Aggregate view for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_usage_summary(_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE (
  user_id uuid,
  full_name text,
  plan public.plan_tier,
  credits_seconds int,
  transcribe_count bigint,
  dub_count bigint,
  translate_count bigint,
  total_events bigint,
  caption_seconds_used bigint,
  dub_seconds_used bigint,
  export_count_used bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.plan,
    p.credits_seconds,
    COALESCE(SUM(CASE WHEN ue.function_name = 'transcribe' THEN 1 ELSE 0 END), 0) AS transcribe_count,
    COALESCE(SUM(CASE WHEN ue.function_name = 'dub-video' THEN 1 ELSE 0 END), 0) AS dub_count,
    COALESCE(SUM(CASE WHEN ue.function_name = 'translate-captions' THEN 1 ELSE 0 END), 0) AS translate_count,
    COALESCE(COUNT(ue.id), 0) AS total_events,
    COALESCE((SELECT SUM(used) FROM public.usage_meters um WHERE um.user_id = p.id AND um.kind = 'caption_seconds' AND um.period_start = date_trunc('month', now() at time zone 'utc')::date), 0),
    COALESCE((SELECT SUM(used) FROM public.usage_meters um WHERE um.user_id = p.id AND um.kind = 'dub_seconds' AND um.period_start = date_trunc('month', now() at time zone 'utc')::date), 0),
    COALESCE((SELECT SUM(used) FROM public.usage_meters um WHERE um.user_id = p.id AND um.kind = 'export_count' AND um.period_start = date_trunc('month', now() at time zone 'utc')::date), 0)
  FROM public.profiles p
  LEFT JOIN public.usage_events ue
    ON ue.user_id = p.id AND ue.created_at >= _since
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY p.id, p.full_name, p.plan, p.credits_seconds
  ORDER BY total_events DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) TO authenticated;

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
create table if not exists public.export_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  outcome text not null check (outcome in ('success','failure','canceled')),
  path text check (path in ('demux-decode','realtime-playback','mediarecorder-fallback')),
  browser text,
  resolution text not null,
  codec text not null,
  profile text,
  level text,
  bitrate integer not null,
  fps_target integer not null,
  encode_time_ms integer not null,
  frames_encoded integer,
  effective_fps numeric(10,2),
  realtime_multiplier numeric(10,3),
  source_duration_sec numeric(10,3),
  source_width integer,
  source_height integer,
  output_bytes bigint,
  error_category text check (error_category in ('codec','decode','quota','network','abort','unknown')),
  error_message text
);

create index if not exists export_metrics_created_at_idx on public.export_metrics (created_at desc);
create index if not exists export_metrics_user_idx on public.export_metrics (user_id, created_at desc);
create index if not exists export_metrics_regression_idx on public.export_metrics (browser, codec, resolution, created_at desc);

grant select on public.export_metrics to authenticated;
grant insert on public.export_metrics to authenticated;
grant all on public.export_metrics to service_role;

alter table public.export_metrics enable row level security;

create policy "export_metrics select own"
  on public.export_metrics for select to authenticated
  using (auth.uid() = user_id);

create policy "export_metrics select admin"
  on public.export_metrics for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "export_metrics insert own"
  on public.export_metrics for insert to authenticated
  with check (auth.uid() = user_id);
-- Category enum
DO $$ BEGIN
  CREATE TYPE public.asset_category AS ENUM ('font','image','audio','video','logo','preset');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category public.asset_category NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assets TO authenticated;
GRANT ALL ON public.user_assets TO service_role;

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assets"
  ON public.user_assets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_assets_user_created_idx ON public.user_assets(user_id, created_at DESC);
CREATE INDEX user_assets_user_category_idx ON public.user_assets(user_id, category);

CREATE TRIGGER user_assets_set_updated_at
  BEFORE UPDATE ON public.user_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for `assets` bucket (mirror `media` bucket pattern)
CREATE POLICY "Users read own assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Enum for team roles
DO $$ BEGIN
  CREATE TYPE public.team_role AS ENUM ('owner','admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX team_members_user_idx ON public.team_members(user_id);
CREATE INDEX team_members_team_idx ON public.team_members(team_id);

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.team_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);
CREATE INDEX team_invitations_email_idx ON public.team_invitations(lower(email));

-- Optional team on projects
ALTER TABLE public.projects ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX projects_team_idx ON public.projects(team_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_invitations TO service_role;

-- Security-definer helpers (avoid recursive RLS on team_members)
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.team_role_of(_team_id uuid, _user_id uuid)
RETURNS public.team_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.team_role_of(_team_id, _user_id) IN ('owner','admin');
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

-- Auto-add owner as member on team insert
CREATE OR REPLACE FUNCTION public.attach_team_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_attach_owner
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.attach_team_owner();

-- updated_at trigger
CREATE TRIGGER teams_set_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- teams policies
CREATE POLICY "Members see their teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Users create teams they own" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Managers update team" ON public.teams FOR UPDATE TO authenticated
  USING (public.can_manage_team(id, auth.uid()))
  WITH CHECK (public.can_manage_team(id, auth.uid()));

CREATE POLICY "Owners delete team" ON public.teams FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- team_members policies
CREATE POLICY "Members see co-members" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Managers or self insert member" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Managers change roles" ON public.team_members FOR UPDATE TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner')
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner');

CREATE POLICY "Manager remove or self leave" ON public.team_members FOR DELETE TO authenticated
  USING (
    (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner')
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- team_invitations policies
CREATE POLICY "Managers see invitations" ON public.team_invitations FOR SELECT TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()) OR lower(email) = public.current_user_email());

CREATE POLICY "Managers invite" ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Managers revoke invitations" ON public.team_invitations FOR DELETE TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()));

-- Accept invitation RPC
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.team_invitations%rowtype;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = 'P0001';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM public.team_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0001'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already accepted' USING ERRCODE='P0001'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation expired' USING ERRCODE='P0001'; END IF;
  IF lower(v_inv.email) <> v_email THEN RAISE EXCEPTION 'invitation email mismatch' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_inv.team_id, auth.uid(), v_inv.role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.team_invitations SET accepted_at = now() WHERE id = v_inv.id;
  RETURN v_inv.team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

-- List invitations for current signed-in user's email
CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE (
  id uuid, team_id uuid, team_name text, role public.team_role,
  token text, expires_at timestamptz, invited_by uuid, invited_by_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.team_id, t.name, i.role, i.token, i.expires_at, i.invited_by, p.full_name
  FROM public.team_invitations i
  JOIN public.teams t ON t.id = i.team_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.accepted_at IS NULL
    AND i.expires_at > now()
    AND lower(i.email) = public.current_user_email();
$$;
REVOKE ALL ON FUNCTION public.my_pending_invitations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;

-- Update projects RLS: team members can see team projects
DROP POLICY IF EXISTS "Users manage their projects" ON public.projects;
CREATE POLICY "Owner or team member sees project" ON public.projects FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Owner inserts project" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or team editor updates project" ON public.projects FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.team_role_of(team_id, auth.uid()) IN ('owner','admin','editor'))
  );
CREATE POLICY "Owner or team manager deletes project" ON public.projects FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.can_manage_team(team_id, auth.uid()))
  );

CREATE TYPE public.error_severity AS ENUM ('info','warning','error','critical');
CREATE TYPE public.error_source AS ENUM ('frontend','edge_function','database','external');

CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  severity public.error_severity NOT NULL DEFAULT 'error',
  source public.error_source NOT NULL DEFAULT 'frontend',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  release TEXT,
  function_name TEXT,
  user_id UUID,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX error_logs_fingerprint_idx ON public.error_logs (fingerprint);
CREATE INDEX error_logs_last_seen_idx ON public.error_logs (last_seen_at DESC);
CREATE INDEX error_logs_severity_idx ON public.error_logs (severity);
CREATE INDEX error_logs_resolved_idx ON public.error_logs (resolved);

GRANT SELECT, UPDATE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update error logs"
ON public.error_logs FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Upsert function used by the log-error edge function
CREATE OR REPLACE FUNCTION public.record_error_log(
  _fingerprint TEXT,
  _severity public.error_severity,
  _source public.error_source,
  _message TEXT,
  _stack TEXT,
  _url TEXT,
  _user_agent TEXT,
  _release TEXT,
  _function_name TEXT,
  _user_id UUID,
  _context JSONB
) RETURNS TABLE(id UUID, occurrence_count INTEGER, is_new BOOLEAN, severity public.error_severity, alerted_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.error_logs%rowtype;
BEGIN
  SELECT * INTO v_existing FROM public.error_logs WHERE fingerprint = _fingerprint;
  IF FOUND THEN
    UPDATE public.error_logs
       SET occurrence_count = occurrence_count + 1,
           last_seen_at = now(),
           message = _message,
           stack = COALESCE(_stack, stack),
           url = COALESCE(_url, url),
           user_agent = COALESCE(_user_agent, user_agent),
           context = _context,
           resolved = false,
           resolved_at = NULL
     WHERE id = v_existing.id
     RETURNING public.error_logs.id, public.error_logs.occurrence_count, false, public.error_logs.severity, public.error_logs.alerted_at
        INTO id, occurrence_count, is_new, severity, alerted_at;
    RETURN NEXT;
  ELSE
    INSERT INTO public.error_logs (fingerprint, severity, source, message, stack, url, user_agent, release, function_name, user_id, context)
    VALUES (_fingerprint, _severity, _source, _message, _stack, _url, _user_agent, _release, _function_name, _user_id, _context)
    RETURNING public.error_logs.id, public.error_logs.occurrence_count, true, public.error_logs.severity, public.error_logs.alerted_at
        INTO id, occurrence_count, is_new, severity, alerted_at;
    RETURN NEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_error_alerted(_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.error_logs SET alerted_at = now() WHERE id = _id;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_error_alerted(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_error_log(text, error_severity, error_source, text, text, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_team_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='usage_meters') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_meters;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='usage_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
ALTER TABLE public.usage_meters REPLICA IDENTITY FULL;
ALTER TABLE public.usage_events REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind public.meter_kind NOT NULL,
  threshold_pct INT NOT NULL DEFAULT 80 CHECK (threshold_pct BETWEEN 1 AND 99),
  in_app_on BOOLEAN NOT NULL DEFAULT true,
  email_on BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_period DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_alerts TO authenticated;
GRANT ALL ON public.usage_alerts TO service_role;

ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own usage alerts"
  ON public.usage_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER usage_alerts_set_updated_at
  BEFORE UPDATE ON public.usage_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_alerts;
ALTER TABLE public.usage_alerts REPLICA IDENTITY FULL;
CREATE OR REPLACE FUNCTION public.record_error_log(
  _fingerprint text,
  _severity public.error_severity,
  _source public.error_source,
  _message text,
  _stack text,
  _url text,
  _user_agent text,
  _release text,
  _function_name text,
  _user_id uuid,
  _context jsonb
)
RETURNS TABLE(
  id uuid,
  occurrence_count integer,
  is_new boolean,
  severity public.error_severity,
  alerted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.error_logs%rowtype;
  v_id uuid;
  v_count integer;
  v_is_new boolean;
  v_severity public.error_severity;
  v_alerted_at timestamptz;
BEGIN
  SELECT * INTO v_existing FROM public.error_logs WHERE fingerprint = _fingerprint;
  IF FOUND THEN
    UPDATE public.error_logs AS el
       SET occurrence_count = el.occurrence_count + 1,
           last_seen_at = now(),
           message = _message,
           stack = COALESCE(_stack, el.stack),
           url = COALESCE(_url, el.url),
           user_agent = COALESCE(_user_agent, el.user_agent),
           context = _context,
           resolved = false,
           resolved_at = NULL
     WHERE el.id = v_existing.id
     RETURNING el.id, el.occurrence_count, false, el.severity, el.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  ELSE
    INSERT INTO public.error_logs (fingerprint, severity, source, message, stack, url, user_agent, release, function_name, user_id, context)
    VALUES (_fingerprint, _severity, _source, _message, _stack, _url, _user_agent, _release, _function_name, _user_id, _context)
    RETURNING public.error_logs.id, public.error_logs.occurrence_count, true, public.error_logs.severity, public.error_logs.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  END IF;

  id := v_id;
  occurrence_count := v_count;
  is_new := v_is_new;
  severity := v_severity;
  alerted_at := v_alerted_at;
  RETURN NEXT;
END;
$function$;

CREATE TYPE public.security_finding_status AS ENUM ('open','accepted','fixed');
CREATE TYPE public.security_finding_severity AS ENUM ('info','low','medium','high','critical');

CREATE TABLE public.security_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_name TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity public.security_finding_severity NOT NULL DEFAULT 'medium',
  status public.security_finding_status NOT NULL DEFAULT 'open',
  resource TEXT,
  notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX security_findings_scanner_ext_uniq ON public.security_findings(scanner_name, external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_findings TO authenticated;
GRANT ALL ON public.security_findings TO service_role;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security findings" ON public.security_findings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert security findings" ON public.security_findings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update security findings" ON public.security_findings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete security findings" ON public.security_findings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_security_findings_updated
  BEFORE UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_grant_access(
  _user_id uuid,
  _plan plan_tier DEFAULT NULL,
  _credits_seconds integer DEFAULT NULL,
  _mode text DEFAULT 'add'  -- 'add' or 'set'
)
RETURNS TABLE(user_id uuid, plan plan_tier, credits_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = 'P0001';
  END IF;
  IF _mode NOT IN ('add','set') THEN
    RAISE EXCEPTION 'invalid mode' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles p
     SET plan = COALESCE(_plan, p.plan),
         credits_seconds = CASE
           WHEN _credits_seconds IS NULL THEN p.credits_seconds
           WHEN _mode = 'set' THEN GREATEST(_credits_seconds, 0)
           ELSE GREATEST(COALESCE(p.credits_seconds,0) + _credits_seconds, 0)
         END,
         updated_at = now()
   WHERE p.id = _user_id
   RETURNING p.id, p.plan, p.credits_seconds
     INTO user_id, plan, credits_seconds;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;

-- 1) Grant admin role to owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('64f73634-1f54-4cd6-83f4-b57d709747c5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Protect owner admin row from deletion / role change
CREATE OR REPLACE FUNCTION public.protect_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.user_id = '64f73634-1f54-4cd6-83f4-b57d709747c5' AND OLD.role = 'admin') THEN
    RAISE EXCEPTION 'owner admin cannot be removed';
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.user_id = '64f73634-1f54-4cd6-83f4-b57d709747c5' AND OLD.role = 'admin' AND NEW.role <> 'admin') THEN
    RAISE EXCEPTION 'owner admin role cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_admin_trg ON public.user_roles;
CREATE TRIGGER protect_owner_admin_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_admin();

-- 3) admin_set_role: grant or revoke a role for a user (by id or email)
CREATE OR REPLACE FUNCTION public.admin_set_role(
  _user_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _role app_role DEFAULT 'admin',
  _grant boolean DEFAULT true
)
RETURNS TABLE(user_id uuid, role app_role, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := _user_id;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NULL AND _email IS NOT NULL THEN
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0001';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
    user_id := v_uid; role := _role; granted := true; RETURN NEXT;
  ELSE
    DELETE FROM public.user_roles WHERE user_roles.user_id = v_uid AND user_roles.role = _role;
    user_id := v_uid; role := _role; granted := false; RETURN NEXT;
  END IF;
END;
$$;

-- 4) admin_list_users: enriched listing with email + admin flag
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, full_name text, plan plan_tier, credits_seconds integer, is_admin boolean, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, u.email, p.full_name, p.plan, p.credits_seconds,
         EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin') AS is_admin,
         p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC NULLS LAST;
$$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;
-- Fix 1: Allow team members to view captions for team-shared projects
CREATE POLICY "Team members can view shared project captions"
ON public.captions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = captions.project_id
      AND p.team_id IS NOT NULL
      AND public.is_team_member(p.team_id, auth.uid())
  )
);

-- Fix 2: Create a token-free view for invitees; restrict base table SELECT for invitees
-- Drop old broad SELECT policy and split into managers-only + no invitee direct access to base table
DROP POLICY IF EXISTS "Managers see invitations" ON public.team_invitations;

CREATE POLICY "Managers see invitations"
ON public.team_invitations FOR SELECT
USING (public.can_manage_team(team_id, auth.uid()));

-- Invitees should use the my_pending_invitations() RPC (already exists, security definer)
-- which returns the token only to the matching email. No direct base-table access needed.

-- jobs: allow owners to write their own rows; service_role bypasses RLS
CREATE POLICY "Users insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- usage_events: writes only via service_role (edge functions). Explicit deny for clients.
CREATE POLICY "No client inserts on usage_events" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on usage_events" ON public.usage_events FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on usage_events" ON public.usage_events FOR DELETE TO authenticated USING (false);

-- usage_meters: writes only via service_role. Explicit deny for clients.
CREATE POLICY "No client inserts on usage_meters" ON public.usage_meters FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on usage_meters" ON public.usage_meters FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on usage_meters" ON public.usage_meters FOR DELETE TO authenticated USING (false);
-- Tighten EXECUTE grants on SECURITY DEFINER functions.
-- Postgres grants EXECUTE to PUBLIC by default; revoke and grant to specific roles.

-- Client-callable (authenticated only)
REVOKE EXECUTE ON FUNCTION public.my_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.my_pending_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_error_log(text, error_severity, error_source, text, text, text, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_error_log(text, error_severity, error_source, text, text, text, text, text, text, uuid, jsonb) TO authenticated, service_role;

-- Server-only (edge functions use service_role)
REVOKE EXECUTE ON FUNCTION public.consume_quota(uuid, meter_kind, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, meter_kind, bigint) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, integer, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_error_alerted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_error_alerted(uuid) TO service_role;

-- Internal helpers used inside RLS/other SECURITY DEFINER functions.
-- Keep executable by authenticated so RLS predicates work under their JWT.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) TO authenticated, service_role;ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_use_case text;
REVOKE EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_owner_admin() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) TO authenticated;
drop policy if exists "hero-media public read" on storage.objects;
create policy "hero-media public read" on storage.objects for select to anon, authenticated
using (bucket_id = 'hero-media');

drop policy if exists "hero-media admin write" on storage.objects;
create policy "hero-media admin write" on storage.objects for insert to authenticated
with check (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "hero-media admin update" on storage.objects;
create policy "hero-media admin update" on storage.objects for update to authenticated
using (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "hero-media admin delete" on storage.objects;
create policy "hero-media admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'hero-media' and public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.hero_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  storage_path text,
  label text,
  orientation text NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait','landscape')),
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hero_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_media TO authenticated;
GRANT ALL ON public.hero_media TO service_role;

ALTER TABLE public.hero_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_media public read" ON public.hero_media FOR SELECT USING (true);
CREATE POLICY "hero_media admin insert" ON public.hero_media FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hero_media admin update" ON public.hero_media FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hero_media admin delete" ON public.hero_media FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Ensure only one active per orientation
CREATE OR REPLACE FUNCTION public.hero_media_single_active()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.hero_media SET is_active = false
      WHERE orientation = NEW.orientation AND id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hero_media_single_active_trg
AFTER INSERT OR UPDATE OF is_active ON public.hero_media
FOR EACH ROW WHEN (NEW.is_active) EXECUTE FUNCTION public.hero_media_single_active();

CREATE OR REPLACE FUNCTION public.auto_grant_admin_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowlist text[] := ARRAY['saifyautomates@gmail.com','jackxparrowww@gmail.com'];
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) = ANY(allowlist) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_allowlist ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_allowlist
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_allowlist();

-- Backfill: grant admin to any existing account matching the allowlist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('saifyautomates@gmail.com','jackxparrowww@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Security audit log for admin role changes + admin-route access
-- ============================================================
CREATE TYPE public.security_audit_kind AS ENUM (
  'role_granted',
  'role_revoked',
  'admin_access_denied',
  'admin_access_ok'
);

CREATE TABLE public.security_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          public.security_audit_kind NOT NULL,
  actor_id      uuid,               -- who performed the action (auth.uid())
  subject_id    uuid,               -- user affected (for role changes)
  role          public.app_role,
  path          text,               -- route path for access-denied events
  suspicious    boolean NOT NULL DEFAULT false,
  reason        text,               -- why we flagged it (rate/self-grant/…)
  user_agent    text,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_audit_log_created_at_idx
  ON public.security_audit_log (created_at DESC);
CREATE INDEX security_audit_log_suspicious_idx
  ON public.security_audit_log (suspicious, created_at DESC);
CREATE INDEX security_audit_log_actor_idx
  ON public.security_audit_log (actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log
CREATE POLICY "Admins read security audit"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Any signed-in user can insert an event, but only about themselves as actor.
-- This lets the client-side AdminRoute guard record denied attempts.
CREATE POLICY "Users log their own security events"
  ON public.security_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- Role change audit trigger
-- Logs INSERTs (grants) and DELETEs (revokes) on user_roles
-- and flags them suspicious when:
--   * the actor grants/revokes their own role (self-service escalation), OR
--   * >5 role changes by the same actor within the last 10 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_kind  public.security_audit_kind;
  v_subject uuid;
  v_role  public.app_role;
  v_recent int;
  v_suspicious boolean := false;
  v_reason text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_kind := 'role_granted';
    v_subject := NEW.user_id;
    v_role := NEW.role;
  ELSIF TG_OP = 'DELETE' THEN
    v_kind := 'role_revoked';
    v_subject := OLD.user_id;
    v_role := OLD.role;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Self-modification of a privileged role is always suspicious
  IF v_actor IS NOT NULL AND v_actor = v_subject AND v_role IN ('admin','moderator') THEN
    v_suspicious := true;
    v_reason := 'self_role_change';
  END IF;

  -- Burst detection: >5 role changes in 10 minutes by same actor
  IF v_actor IS NOT NULL THEN
    SELECT count(*) INTO v_recent
      FROM public.security_audit_log
     WHERE actor_id = v_actor
       AND kind IN ('role_granted','role_revoked')
       AND created_at > now() - interval '10 minutes';
    IF v_recent >= 5 THEN
      v_suspicious := true;
      v_reason := COALESCE(v_reason || '+', '') || 'burst_role_changes';
    END IF;
  END IF;

  INSERT INTO public.security_audit_log
    (kind, actor_id, subject_id, role, suspicious, reason, context)
  VALUES
    (v_kind, v_actor, v_subject, v_role, v_suspicious, v_reason,
     jsonb_build_object('op', TG_OP));

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

-- ============================================================
-- RPC: log an admin-route access attempt (called by AdminRoute)
-- Flags suspicious when the same non-admin user has been denied
-- 3+ times in the last 10 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_access_attempt(
  _path text,
  _allowed boolean,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent int;
  v_susp boolean := false;
  v_reason text := NULL;
  v_kind public.security_audit_kind;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = 'P0001';
  END IF;

  v_kind := CASE WHEN _allowed THEN 'admin_access_ok' ELSE 'admin_access_denied' END;

  IF NOT _allowed THEN
    SELECT count(*) INTO v_recent
      FROM public.security_audit_log
     WHERE actor_id = v_uid
       AND kind = 'admin_access_denied'
       AND created_at > now() - interval '10 minutes';
    IF v_recent >= 2 THEN  -- this attempt is the 3rd
      v_susp := true;
      v_reason := 'repeated_admin_denial';
    END IF;
  END IF;

  INSERT INTO public.security_audit_log
    (kind, actor_id, subject_id, path, suspicious, reason, user_agent)
  VALUES
    (v_kind, v_uid, v_uid, _path, v_susp, v_reason, _user_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_access_attempt(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, text) TO authenticated;

-- ============================================================
-- Admin summary view
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_security_alerts(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, kind public.security_audit_kind, actor_id uuid, actor_email text,
  subject_id uuid, subject_email text, role public.app_role, path text,
  suspicious boolean, reason text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.kind, s.actor_id, ua.email, s.subject_id, us.email,
         s.role, s.path, s.suspicious, s.reason, s.created_at
    FROM public.security_audit_log s
    LEFT JOIN auth.users ua ON ua.id = s.actor_id
    LEFT JOIN auth.users us ON us.id = s.subject_id
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY s.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.admin_security_alerts(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_alerts(int) TO authenticated;

-- ============ platform_settings ============
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings public read"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "platform_settings admin insert"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "platform_settings admin update"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "platform_settings admin delete"
  ON public.platform_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.platform_settings (key, value) VALUES
  ('maintenance_mode', jsonb_build_object('enabled', false, 'message', 'We''re performing scheduled maintenance. Back shortly.')),
  ('plan_limits', jsonb_build_object('free_minutes', 30, 'pro_minutes', 300, 'team_minutes', 1800)),
  ('upload_rules', jsonb_build_object('max_upload_mb', 1024, 'allowed_types', ARRAY['mp4','mov','webm','mkv','m4a','mp3','wav'])),
  ('feature_flags', jsonb_build_object('new_editor', true, 'ai_translate', true, 'realtime_collab', false))
ON CONFLICT (key) DO NOTHING;

-- ============ activity_log ============
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON public.activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON public.activity_log (action_type, created_at DESC);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log admin read all"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Trigger helper
CREATE OR REPLACE FUNCTION public.log_activity_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, action_type, metadata)
  VALUES (NEW.id, 'user_signup', jsonb_build_object('email', NEW.email));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_activity ON auth.users;
CREATE TRIGGER on_auth_user_created_activity
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_signup();

CREATE OR REPLACE FUNCTION public.log_activity_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (user_id, action_type, metadata)
  VALUES (NEW.user_id, 'project_created',
    jsonb_build_object('project_id', NEW.id, 'title', NEW.title));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_project_created_activity ON public.projects;
CREATE TRIGGER on_project_created_activity
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_project();

CREATE OR REPLACE FUNCTION public.log_activity_export()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.outcome = 'success' THEN
    INSERT INTO public.activity_log (user_id, action_type, metadata)
    VALUES (NEW.user_id, 'export_completed',
      jsonb_build_object('resolution', NEW.resolution, 'codec', NEW.codec));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_export_metric_activity ON public.export_metrics;
CREATE TRIGGER on_export_metric_activity
  AFTER INSERT ON public.export_metrics
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_export();

CREATE OR REPLACE FUNCTION public.log_activity_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('captured','paid','succeeded') THEN
    INSERT INTO public.activity_log (user_id, action_type, metadata)
    VALUES (NEW.user_id, 'payment_received',
      jsonb_build_object('amount_paise', NEW.amount_paise, 'currency', NEW.currency, 'plan', NEW.plan));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_payment_activity ON public.payments;
CREATE TRIGGER on_payment_activity
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_payment();

-- ============ admin_overview_stats RPC ============
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_start_30 timestamptz := v_now - interval '30 days';
  v_start_60 timestamptz := v_now - interval '60 days';
  v_total_users int;
  v_users_30 int;
  v_users_prev int;
  v_active_projects int;
  v_projects_30 int;
  v_projects_prev int;
  v_total_exports int;
  v_exports_30 int;
  v_exports_prev int;
  v_revenue_30 bigint;
  v_revenue_prev bigint;
  v_signups_series jsonb;
  v_projects_series jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_users_30 FROM public.profiles WHERE created_at >= v_start_30;
  SELECT count(*) INTO v_users_prev FROM public.profiles WHERE created_at >= v_start_60 AND created_at < v_start_30;

  SELECT count(*) INTO v_active_projects FROM public.projects WHERE status <> 'failed';
  SELECT count(*) INTO v_projects_30 FROM public.projects WHERE created_at >= v_start_30;
  SELECT count(*) INTO v_projects_prev FROM public.projects WHERE created_at >= v_start_60 AND created_at < v_start_30;

  SELECT count(*) INTO v_total_exports FROM public.export_metrics WHERE outcome = 'success';
  SELECT count(*) INTO v_exports_30 FROM public.export_metrics WHERE outcome = 'success' AND created_at >= v_start_30;
  SELECT count(*) INTO v_exports_prev FROM public.export_metrics WHERE outcome = 'success' AND created_at >= v_start_60 AND created_at < v_start_30;

  SELECT COALESCE(SUM(amount_paise),0) INTO v_revenue_30
    FROM public.payments
   WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_30;
  SELECT COALESCE(SUM(amount_paise),0) INTO v_revenue_prev
    FROM public.payments
   WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_60 AND created_at < v_start_30;

  SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c, 0)) ORDER BY d)
    INTO v_signups_series
    FROM generate_series(v_start_30::date, v_now::date, interval '1 day') d
    LEFT JOIN (
      SELECT date_trunc('day', created_at)::date AS day, count(*) AS c
        FROM public.profiles
       WHERE created_at >= v_start_30
       GROUP BY 1
    ) s ON s.day = d::date;

  SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c, 0)) ORDER BY d)
    INTO v_projects_series
    FROM generate_series(v_start_30::date, v_now::date, interval '1 day') d
    LEFT JOIN (
      SELECT date_trunc('day', created_at)::date AS day, count(*) AS c
        FROM public.projects
       WHERE created_at >= v_start_30
       GROUP BY 1
    ) s ON s.day = d::date;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'users_30', v_users_30,
    'users_prev', v_users_prev,
    'active_projects', v_active_projects,
    'projects_30', v_projects_30,
    'projects_prev', v_projects_prev,
    'total_exports', v_total_exports,
    'exports_30', v_exports_30,
    'exports_prev', v_exports_prev,
    'revenue_30_paise', v_revenue_30,
    'revenue_prev_paise', v_revenue_prev,
    'signups_series', COALESCE(v_signups_series, '[]'::jsonb),
    'projects_series', COALESCE(v_projects_series, '[]'::jsonb)
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;

-- ============ admin_subscriptions_summary RPC ============
CREATE OR REPLACE FUNCTION public.admin_subscriptions_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_start_30 timestamptz := v_now - interval '30 days';
  v_mrr_paise bigint;
  v_paid_users int;
  v_churned int;
  v_new_paid int;
  v_revenue_series jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount_paise),0) INTO v_mrr_paise
    FROM public.payments
   WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_30;

  SELECT count(DISTINCT user_id) INTO v_paid_users
    FROM public.subscriptions WHERE status = 'active';

  SELECT count(*) INTO v_churned
    FROM public.subscriptions
   WHERE status IN ('cancelled','canceled') AND created_at >= v_start_30;

  SELECT count(*) INTO v_new_paid
    FROM public.subscriptions
   WHERE status = 'active' AND created_at >= v_start_30;

  SELECT jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'), 'revenue_paise', COALESCE(r, 0)) ORDER BY m)
    INTO v_revenue_series
    FROM generate_series(date_trunc('month', v_now) - interval '11 months', date_trunc('month', v_now), interval '1 month') m
    LEFT JOIN (
      SELECT date_trunc('month', created_at) AS mo, SUM(amount_paise) AS r
        FROM public.payments
       WHERE status IN ('captured','paid','succeeded')
       GROUP BY 1
    ) p ON p.mo = m;

  RETURN jsonb_build_object(
    'mrr_paise', v_mrr_paise,
    'paid_users', v_paid_users,
    'churned', v_churned,
    'new_paid', v_new_paid,
    'revenue_series', COALESCE(v_revenue_series, '[]'::jsonb)
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_subscriptions_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_subscriptions_summary() TO authenticated;

-- ============ admin_update_setting RPC ============
CREATE OR REPLACE FUNCTION public.admin_update_setting(_key text, _value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES (_key, _value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  RETURN _value;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) TO authenticated;

-- ============ admin_delete_user RPC ============
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF _user_id = '64f73634-1f54-4cd6-83f4-b57d709747c5' THEN
    RAISE EXCEPTION 'owner admin cannot be deleted';
  END IF;
  DELETE FROM auth.users WHERE id = _user_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ============ admin_list_projects RPC ============
CREATE OR REPLACE FUNCTION public.admin_list_projects(_limit int DEFAULT 50, _offset int DEFAULT 0, _status text DEFAULT NULL, _search text DEFAULT NULL)
RETURNS TABLE(
  id uuid, title text, status project_status, duration_seconds int,
  created_at timestamptz, user_id uuid, owner_email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.status, p.duration_seconds, p.created_at, p.user_id, u.email
    FROM public.projects p
    LEFT JOIN auth.users u ON u.id = p.user_id
   WHERE public.has_role(auth.uid(), 'admin')
     AND (_status IS NULL OR p.status::text = _status)
     AND (_search IS NULL OR p.title ILIKE '%' || _search || '%' OR u.email ILIKE '%' || _search || '%')
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200))
   OFFSET GREATEST(_offset, 0);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_projects(int, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(int, int, text, text) TO authenticated;

-- ============ admin_recent_activity RPC ============
CREATE OR REPLACE FUNCTION public.admin_recent_activity(_limit int DEFAULT 20)
RETURNS TABLE(id uuid, user_id uuid, email text, action_type text, metadata jsonb, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.user_id, u.email, a.action_type, a.metadata, a.created_at
    FROM public.activity_log a
    LEFT JOIN auth.users u ON u.id = a.user_id
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY a.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

REVOKE EXECUTE ON FUNCTION public.admin_recent_activity(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(int) TO authenticated;

CREATE TABLE public.hero_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL UNIQUE,
  source_lang text,
  source_text text NOT NULL,
  words jsonb NOT NULL,
  duration double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_transcripts TO anon, authenticated;
GRANT ALL ON public.hero_transcripts TO service_role;
ALTER TABLE public.hero_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_transcripts public read" ON public.hero_transcripts FOR SELECT USING (true);

CREATE TABLE public.hero_transcript_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  lang text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_url, lang)
);
GRANT SELECT ON public.hero_transcript_translations TO anon, authenticated;
GRANT ALL ON public.hero_transcript_translations TO service_role;
ALTER TABLE public.hero_transcript_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_translations public read" ON public.hero_transcript_translations FOR SELECT USING (true);
REVOKE EXECUTE ON FUNCTION public.log_activity_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity_project() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity_export() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity_payment() FROM PUBLIC;REVOKE EXECUTE ON FUNCTION public.auto_grant_admin_allowlist() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_user_role_change() FROM PUBLIC;CREATE OR REPLACE FUNCTION public.record_error_log(
  _fingerprint text,
  _severity public.error_severity,
  _source public.error_source,
  _message text,
  _stack text,
  _url text,
  _user_agent text,
  _release text,
  _function_name text,
  _user_id uuid,
  _context jsonb
)
RETURNS TABLE(id uuid, occurrence_count integer, is_new boolean, severity public.error_severity, alerted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.error_logs%rowtype;
  v_id uuid;
  v_count integer;
  v_is_new boolean;
  v_severity public.error_severity;
  v_alerted_at timestamptz;
  v_caller uuid := auth.uid();
BEGIN
  -- Defense-in-depth: if invoked with an authenticated JWT, the _user_id
  -- must match the caller. service_role calls (from the log-error edge
  -- function) have auth.uid() = NULL and pass through.
  IF v_caller IS NOT NULL AND _user_id IS NOT NULL AND _user_id <> v_caller THEN
    RAISE EXCEPTION 'user_id mismatch' USING ERRCODE = '42501';
  END IF;

  -- Hard payload caps (mirror edge-function slice() limits).
  _fingerprint   := left(coalesce(_fingerprint, ''), 64);
  _message       := left(coalesce(_message, ''), 2000);
  _stack         := left(_stack, 8000);
  _url           := left(_url, 500);
  _user_agent    := left(_user_agent, 500);
  _release       := left(_release, 100);
  _function_name := left(_function_name, 100);
  IF _message = '' OR _fingerprint = '' THEN
    RAISE EXCEPTION 'message and fingerprint required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM public.error_logs WHERE fingerprint = _fingerprint;
  IF FOUND THEN
    UPDATE public.error_logs AS el
       SET occurrence_count = el.occurrence_count + 1,
           last_seen_at = now(),
           message = _message,
           stack = COALESCE(_stack, el.stack),
           url = COALESCE(_url, el.url),
           user_agent = COALESCE(_user_agent, el.user_agent),
           context = _context,
           resolved = false,
           resolved_at = NULL
     WHERE el.id = v_existing.id
     RETURNING el.id, el.occurrence_count, false, el.severity, el.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  ELSE
    INSERT INTO public.error_logs (fingerprint, severity, source, message, stack, url, user_agent, release, function_name, user_id, context)
    VALUES (_fingerprint, _severity, _source, _message, _stack, _url, _user_agent, _release, _function_name, _user_id, _context)
    RETURNING public.error_logs.id, public.error_logs.occurrence_count, true, public.error_logs.severity, public.error_logs.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  END IF;

  id := v_id;
  occurrence_count := v_count;
  is_new := v_is_new;
  severity := v_severity;
  alerted_at := v_alerted_at;
  RETURN NEXT;
END;
$function$;

-- Remove direct client access. The log-error edge function calls this via service_role.
REVOKE EXECUTE ON FUNCTION public.record_error_log(
  text, public.error_severity, public.error_source, text, text, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_error_log(
  text, public.error_severity, public.error_source, text, text, text, text, text, text, uuid, jsonb
) TO service_role;DROP POLICY IF EXISTS "Team members can view shared project captions" ON public.captions;
CREATE POLICY "Team members can view shared project captions" ON public.captions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = captions.project_id AND p.team_id IS NOT NULL AND public.is_team_member(p.team_id, auth.uid())));

DROP POLICY IF EXISTS "Managers see invitations" ON public.team_invitations;
CREATE POLICY "Managers see invitations" ON public.team_invitations
FOR SELECT TO authenticated
USING (public.can_manage_team(team_id, auth.uid()));

DROP POLICY IF EXISTS "Users manage own usage alerts" ON public.usage_alerts;
CREATE POLICY "Users manage own usage alerts" ON public.usage_alerts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated/PUBLIC.
-- Triggers fire regardless of EXECUTE grants; these functions are never called directly.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.audit_user_role_change()',
    'public.auto_grant_admin_allowlist()',
    'public.log_activity_export()',
    'public.log_activity_payment()',
    'public.log_activity_project()',
    'public.log_activity_signup()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
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
CREATE OR REPLACE FUNCTION public.increment_credits_seconds(target_user UUID, add_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total INTEGER;
BEGIN
  UPDATE public.profiles
     SET credits_seconds = COALESCE(credits_seconds, 0) + add_seconds
   WHERE id = target_user
   RETURNING credits_seconds INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_credits_seconds(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_credits_seconds(UUID, INTEGER) TO service_role;-- Lock down SECURITY DEFINER functions so anonymous/public roles cannot execute them.
-- Each function still enforces its own auth checks; this removes the ability
-- for signed-out visitors to even attempt to call them via the Data API.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END $$;

-- Grant EXECUTE to authenticated for functions that signed-in users legitimately call.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, text) TO authenticated;

-- Admin-only functions: allow authenticated callers (function body checks has_role).
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_security_alerts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscriptions_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;

-- Service-role only functions (called from edge functions with service key).
GRANT EXECUTE ON FUNCTION public.record_error_log(text, error_severity, error_source, text, text, text, text, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_error_alerted(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, meter_kind, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_credits_seconds(uuid, integer) TO service_role;

-- Credit wallet: one row per user, single source of truth for balance
CREATE TABLE public.credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_credits numeric NOT NULL DEFAULT 0,
  topup_credits numeric NOT NULL DEFAULT 0,
  plan_credits_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated;
GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_owner_read" ON public.credit_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable ledger: every credit movement
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deduct','refund','topup_purchase','plan_grant','admin_adjust')),
  amount numeric NOT NULL CHECK (amount >= 0),
  balance_after numeric NOT NULL,
  reference_id uuid,
  reference_type text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('reserved','completed','failed','reversed')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_user_created_idx ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX credit_transactions_reference_idx ON public.credit_transactions(reference_type, reference_id);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_owner_read" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Rate config: editable by admin without redeploying
CREATE TABLE public.credit_rates (
  feature text PRIMARY KEY,
  credits_per_unit numeric NOT NULL CHECK (credits_per_unit >= 0),
  unit text NOT NULL DEFAULT 'minute',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_rates TO authenticated, anon;
GRANT ALL ON public.credit_rates TO service_role;
ALTER TABLE public.credit_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_public_read" ON public.credit_rates
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "rates_admin_write" ON public.credit_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_credit_rates_updated_at
  BEFORE UPDATE ON public.credit_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default rates
INSERT INTO public.credit_rates (feature, credits_per_unit, unit) VALUES
  ('transcription', 1, 'minute'),
  ('caption_burn', 1, 'minute'),
  ('ai_dubbing_per_language', 5, 'minute'),
  ('translation', 0.5, 'minute')
ON CONFLICT (feature) DO NOTHING;

-- Atomic deduct RPC. Consumes plan_credits first, then topup_credits.
-- Writes a ledger row and returns the new balance. Admins are logged
-- but never blocked (unlimited).
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id uuid,
  _amount numeric,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  from_plan numeric := 0;
  from_topup numeric := 0;
  remaining numeric;
  new_balance numeric;
  v_tx uuid;
  v_admin boolean := public.has_role(_user_id, 'admin');
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure wallet row exists, lock it
  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF v_admin THEN
    -- Admins: record ledger, no balance change
    new_balance := w.plan_credits + w.topup_credits;
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
    VALUES (_user_id, 'deduct', _amount, new_balance, _reference_type, _reference_id,
            COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('admin_bypass', true), 'completed')
    RETURNING id INTO v_tx;
    plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := new_balance; tx_id := v_tx;
    RETURN NEXT; RETURN;
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, numeric, text, uuid, jsonb) TO service_role;

-- Add credits (top-up purchase, plan grant, admin adjust, refund)
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id uuid,
  _amount numeric,
  _bucket text,             -- 'plan' or 'topup'
  _type text,               -- 'topup_purchase' | 'plan_grant' | 'admin_adjust' | 'refund'
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
) RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  v_tx uuid;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;
  IF _bucket NOT IN ('plan','topup') THEN
    RAISE EXCEPTION 'invalid bucket' USING ERRCODE = 'P0001';
  END IF;
  IF _type NOT IN ('topup_purchase','plan_grant','admin_adjust','refund') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF _bucket = 'plan' THEN
    UPDATE public.credit_wallets
       SET plan_credits = plan_credits + _amount,
           plan_credits_reset_at = CASE WHEN _type = 'plan_grant' THEN now() ELSE plan_credits_reset_at END,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  ELSE
    UPDATE public.credit_wallets
       SET topup_credits = topup_credits + _amount,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  END IF;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
  VALUES (_user_id, _type, _amount, w.plan_credits + w.topup_credits, _reference_type, _reference_id,
          COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('bucket', _bucket), 'completed')
  RETURNING id INTO v_tx;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := w.plan_credits + w.topup_credits; tx_id := v_tx;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.add_credits(uuid, numeric, text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, numeric, text, text, text, uuid, jsonb) TO service_role;

-- Auto-create wallet row on signup
CREATE OR REPLACE FUNCTION public.create_credit_wallet_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.credit_wallets(user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_credit_wallet_for_new_user();

-- Backfill wallets for existing users
INSERT INTO public.credit_wallets(user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.credit_wallets%rowtype;
  v_from_plan numeric := 0;
  v_from_topup numeric := 0;
  v_txn_id uuid;
  v_admin boolean := public.has_role(p_user_id, 'admin');
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_admin THEN
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
    VALUES (p_user_id, 'deduct', p_amount, w.plan_credits + w.topup_credits, p_reference_id, p_reference_type, 'reserved',
            COALESCE(p_metadata,'{}'::jsonb) || jsonb_build_object('admin_bypass', true))
    RETURNING id INTO v_txn_id;
    RETURN v_txn_id;
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.reserve_credits(uuid, numeric, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_credits(uuid, numeric, uuid, text, jsonb) TO service_role;

-- Finalize a reservation. If p_actual_amount is smaller, refund the diff.
CREATE OR REPLACE FUNCTION public.finalize_reservation(
  p_txn_id uuid,
  p_actual_amount numeric DEFAULT NULL
) RETURNS TABLE(balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.credit_transactions%rowtype;
  w public.credit_wallets%rowtype;
  v_meta jsonb;
  v_from_plan numeric;
  v_from_topup numeric;
  v_diff numeric := 0;
  v_return_topup numeric := 0;
  v_return_plan numeric := 0;
BEGIN
  SELECT * INTO t FROM public.credit_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'txn not found' USING ERRCODE='P0001'; END IF;
  IF t.status <> 'reserved' THEN RAISE EXCEPTION 'txn not reserved' USING ERRCODE='P0001'; END IF;
  IF t.type <> 'deduct' THEN RAISE EXCEPTION 'wrong type' USING ERRCODE='P0001'; END IF;

  v_meta := COALESCE(t.metadata, '{}'::jsonb);
  v_from_plan := COALESCE((v_meta->>'from_plan')::numeric, 0);
  v_from_topup := COALESCE((v_meta->>'from_topup')::numeric, 0);

  SELECT * INTO w FROM public.credit_wallets WHERE user_id = t.user_id FOR UPDATE;

  IF p_actual_amount IS NOT NULL AND p_actual_amount < t.amount THEN
    v_diff := t.amount - p_actual_amount;
    -- Refund proportionally: topup first (since it was consumed last), then plan.
    v_return_topup := LEAST(v_from_topup, v_diff);
    v_return_plan := v_diff - v_return_topup;
    UPDATE public.credit_wallets
       SET plan_credits = plan_credits + v_return_plan,
           topup_credits = topup_credits + v_return_topup,
           updated_at = now()
     WHERE user_id = t.user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

    IF v_diff > 0 THEN
      INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
      VALUES (t.user_id, 'refund', v_diff, w.plan_credits + w.topup_credits, t.reference_id, t.reference_type, 'completed',
              jsonb_build_object('reservation', p_txn_id, 'to_plan', v_return_plan, 'to_topup', v_return_topup));
    END IF;
  END IF;

  UPDATE public.credit_transactions
     SET status = 'completed',
         amount = COALESCE(p_actual_amount, amount),
         balance_after = w.plan_credits + w.topup_credits,
         metadata = v_meta || jsonb_build_object('finalized_at', now())
   WHERE id = p_txn_id;

  balance := w.plan_credits + w.topup_credits;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_reservation(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_reservation(uuid, numeric) TO service_role;

-- Full refund / release a reservation.
CREATE OR REPLACE FUNCTION public.refund_reservation(
  p_txn_id uuid,
  p_reason text DEFAULT NULL
) RETURNS TABLE(balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.credit_transactions%rowtype;
  w public.credit_wallets%rowtype;
  v_meta jsonb;
  v_from_plan numeric;
  v_from_topup numeric;
BEGIN
  SELECT * INTO t FROM public.credit_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'txn not found' USING ERRCODE='P0001'; END IF;
  IF t.status NOT IN ('reserved','completed') THEN
    RAISE EXCEPTION 'txn not refundable' USING ERRCODE='P0001';
  END IF;
  IF t.type <> 'deduct' THEN RAISE EXCEPTION 'wrong type' USING ERRCODE='P0001'; END IF;

  v_meta := COALESCE(t.metadata, '{}'::jsonb);
  v_from_plan := COALESCE((v_meta->>'from_plan')::numeric, 0);
  v_from_topup := COALESCE((v_meta->>'from_topup')::numeric, 0);
  -- If the deduct didn't split (admin_bypass), nothing to return.
  IF (v_from_plan + v_from_topup) = 0 AND (v_meta ? 'admin_bypass') THEN
    UPDATE public.credit_transactions
       SET status = 'reversed',
           metadata = v_meta || jsonb_build_object('reversed_at', now(), 'reason', p_reason)
     WHERE id = p_txn_id;
    SELECT plan_credits + topup_credits INTO balance FROM public.credit_wallets WHERE user_id = t.user_id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO w FROM public.credit_wallets WHERE user_id = t.user_id FOR UPDATE;

  UPDATE public.credit_wallets
     SET plan_credits = plan_credits + v_from_plan,
         topup_credits = topup_credits + v_from_topup,
         updated_at = now()
   WHERE user_id = t.user_id
   RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;

  INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_id, reference_type, status, metadata)
  VALUES (t.user_id, 'refund', t.amount, w.plan_credits + w.topup_credits, t.reference_id, t.reference_type, 'completed',
          jsonb_build_object('reservation', p_txn_id, 'to_plan', v_from_plan, 'to_topup', v_from_topup, 'reason', p_reason));

  UPDATE public.credit_transactions
     SET status = 'reversed',
         metadata = v_meta || jsonb_build_object('reversed_at', now(), 'reason', p_reason)
   WHERE id = p_txn_id;

  balance := w.plan_credits + w.topup_credits;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_reservation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_reservation(uuid, text) TO service_role;

-- =====================================================================
-- 1. Extensions required for scheduled jobs
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================================
-- 2. templates — reusable caption style presets
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  preview_url  text,
  style        jsonb NOT NULL,
  category     text,
  is_system    boolean NOT NULL DEFAULT false,
  is_public    boolean NOT NULL DEFAULT false,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_owner_idx    ON public.templates(owner_id);
CREATE INDEX IF NOT EXISTS templates_category_idx ON public.templates(category);
CREATE INDEX IF NOT EXISTS templates_system_idx   ON public.templates(is_system) WHERE is_system;

GRANT SELECT                          ON public.templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.templates TO authenticated;
GRANT ALL                             ON public.templates TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_read_visible"
  ON public.templates FOR SELECT
  USING (
    is_system
    OR is_public
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "templates_owner_insert"
  ON public.templates FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND is_system = false                        -- only admins create system templates
  );

CREATE POLICY "templates_owner_update"
  ON public.templates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (owner_id = auth.uid() AND is_system = false)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "templates_owner_delete"
  ON public.templates FOR DELETE TO authenticated
  USING (
    (owner_id = auth.uid() AND is_system = false)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER templates_set_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 3. plan_limits — reference config for the three plans
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan               public.plan_tier PRIMARY KEY,
  monthly_credits    numeric NOT NULL,
  max_video_minutes  numeric NOT NULL,
  max_projects       integer NOT NULL,
  max_team_members   integer NOT NULL,
  can_export_srt     boolean NOT NULL DEFAULT true,
  can_burn_captions  boolean NOT NULL DEFAULT false,
  can_dub            boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT                          ON public.plan_limits TO anon, authenticated;
GRANT ALL                             ON public.plan_limits TO service_role;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_limits_public_read"
  ON public.plan_limits FOR SELECT USING (true);

CREATE POLICY "plan_limits_admin_write"
  ON public.plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.plan_limits
  (plan, monthly_credits, max_video_minutes, max_projects, max_team_members,
   can_export_srt, can_burn_captions, can_dub)
VALUES
  ('starter',   30,  10,   3,  1,  true, false, false),
  ('creator',  300,  60, 100, 10,  true, true,  false),
  ('studio',  1000, 180, 999, 50,  true, true,  true)
ON CONFLICT (plan) DO UPDATE
  SET monthly_credits   = EXCLUDED.monthly_credits,
      max_video_minutes = EXCLUDED.max_video_minutes,
      max_projects      = EXCLUDED.max_projects,
      max_team_members  = EXCLUDED.max_team_members,
      can_export_srt    = EXCLUDED.can_export_srt,
      can_burn_captions = EXCLUDED.can_burn_captions,
      can_dub           = EXCLUDED.can_dub,
      updated_at        = now();

-- =====================================================================
-- 4. Monthly credit reset RPC (called by cron)
--    For every user whose plan is still valid (or has no expiry), overwrite
--    plan_credits with plan_limits.monthly_credits and log a plan_grant
--    ledger row. topup_credits are untouched.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reset_plan_credits_for_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_count    integer := 0;
  v_new_bal  numeric;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, pl.monthly_credits, pl.plan
      FROM public.profiles p
      JOIN public.plan_limits pl ON pl.plan = p.plan
     WHERE p.plan_expires_at IS NULL OR p.plan_expires_at > now()
  LOOP
    INSERT INTO public.credit_wallets(user_id) VALUES (r.user_id)
      ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.credit_wallets
       SET plan_credits          = r.monthly_credits,
           plan_credits_reset_at = now(),
           updated_at            = now()
     WHERE user_id = r.user_id
    RETURNING plan_credits + topup_credits INTO v_new_bal;

    INSERT INTO public.credit_transactions
      (user_id, type, amount, balance_after, status, metadata)
    VALUES
      (r.user_id, 'plan_grant', r.monthly_credits, v_new_bal, 'completed',
       jsonb_build_object('bucket','plan','source','monthly_reset','plan',r.plan));

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_plan_credits_for_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_plan_credits_for_all() TO service_role;

-- =====================================================================
-- 5. Stale-processing cleanup RPC (called by cron)
--    Marks any project stuck in 'processing' for > 30 minutes as 'error'
--    and refunds any credit reservations that reference it.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_processing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_count  integer := 0;
BEGIN
  FOR r IN
    SELECT id
      FROM public.projects
     WHERE status = 'processing'
       AND updated_at < now() - interval '30 minutes'
  LOOP
    UPDATE public.projects
       SET status = 'error', updated_at = now()
     WHERE id = r.id;

    -- Refund any reservations still open for this project
    PERFORM public.refund_reservation(t.id, 'stale_processing_timeout')
       FROM public.credit_transactions t
      WHERE t.reference_id   = r.id
        AND t.reference_type IN ('project','transcribe','dub','export')
        AND t.status         = 'reserved';

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_stale_processing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_processing() TO service_role;

-- =====================================================================
-- 6. Schedule the cron jobs (idempotent — unschedule any prior)
-- =====================================================================
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid, jobname FROM cron.job
     WHERE jobname IN ('monthly-credit-reset','cleanup-stale-jobs')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'monthly-credit-reset',
  '0 0 1 * *',
  $$ SELECT public.reset_plan_credits_for_all(); $$
);

SELECT cron.schedule(
  'cleanup-stale-jobs',
  '*/15 * * * *',
  $$ SELECT public.cleanup_stale_processing(); $$
);

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

CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('text','template','transition','ai_voice','audio')),
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX library_items_category_idx ON public.library_items(category, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT SELECT ON public.library_items TO anon;
GRANT ALL ON public.library_items TO service_role;

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_items readable by everyone (active)"
  ON public.library_items FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin insert"
  ON public.library_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin update"
  ON public.library_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin delete"
  ON public.library_items FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_items_set_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback_submissions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.feedback_submissions TO authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(message) BETWEEN 1 AND 2000
    AND (name IS NULL OR length(name) <= 100)
    AND (email IS NULL OR length(email) <= 255)
  );

CREATE POLICY "Admins can view feedback"
  ON public.feedback_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback"
  ON public.feedback_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback"
  ON public.feedback_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_feedback_submissions_created_at ON public.feedback_submissions (created_at DESC);

-- Add WITH CHECK to the projects update policy so an editor cannot silently
-- reassign ownership (user_id / team_id) by passing the USING predicate alone.
DROP POLICY IF EXISTS "Owner or team editor updates project" ON public.projects;

CREATE POLICY "Owner or team editor updates project"
ON public.projects
FOR UPDATE
USING (
  (user_id = auth.uid())
  OR (team_id IS NOT NULL AND team_role_of(team_id, auth.uid()) = ANY (ARRAY['owner'::team_role, 'admin'::team_role, 'editor'::team_role]))
)
WITH CHECK (
  (user_id = auth.uid())
  OR (team_id IS NOT NULL AND team_role_of(team_id, auth.uid()) = ANY (ARRAY['owner'::team_role, 'admin'::team_role, 'editor'::team_role]))
);

-- Defense in depth: block reassignment of user_id or team_id by anyone other
-- than the current owner or an admin. Team editors can edit content but never
-- transfer ownership.
CREATE OR REPLACE FUNCTION public.projects_guard_ownership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    IF auth.uid() IS NULL
       OR (auth.uid() <> OLD.user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'not authorized to reassign project ownership'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_guard_ownership_change ON public.projects;
CREATE TRIGGER projects_guard_ownership_change
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.projects_guard_ownership_change();

-- Idempotency guard for topup purchases: at most one completed topup_purchase per (user_id, reference_id)
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_topup_dedup_idx
  ON public.credit_transactions (user_id, reference_id)
  WHERE type = 'topup_purchase' AND status = 'completed' AND reference_id IS NOT NULL;

-- Make add_credits idempotent when a reference_id is provided for topup_purchase.
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount numeric, _bucket text, _type text, _reference_type text DEFAULT NULL::text, _reference_id uuid DEFAULT NULL::uuid, _metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(plan_credits numeric, topup_credits numeric, balance numeric, tx_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  w public.credit_wallets%rowtype;
  v_tx uuid;
  v_existing uuid;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = 'P0001';
  END IF;
  IF _bucket NOT IN ('plan','topup') THEN
    RAISE EXCEPTION 'invalid bucket' USING ERRCODE = 'P0001';
  END IF;
  IF _type NOT IN ('topup_purchase','plan_grant','admin_adjust','refund') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: if a completed topup_purchase already exists for this reference_id,
  -- return current wallet state without double-crediting.
  IF _type = 'topup_purchase' AND _reference_id IS NOT NULL THEN
    SELECT id INTO v_existing
      FROM public.credit_transactions
     WHERE user_id = _user_id
       AND type = 'topup_purchase'
       AND status = 'completed'
       AND reference_id = _reference_id
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id;
      plan_credits := COALESCE(w.plan_credits, 0);
      topup_credits := COALESCE(w.topup_credits, 0);
      balance := plan_credits + topup_credits;
      tx_id := v_existing;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.credit_wallets(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.credit_wallets WHERE user_id = _user_id FOR UPDATE;

  IF _bucket = 'plan' THEN
    UPDATE public.credit_wallets
       SET plan_credits = plan_credits + _amount,
           plan_credits_reset_at = CASE WHEN _type = 'plan_grant' THEN now() ELSE plan_credits_reset_at END,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  ELSE
    UPDATE public.credit_wallets
       SET topup_credits = topup_credits + _amount,
           updated_at = now()
     WHERE user_id = _user_id
     RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
  END IF;

  BEGIN
    INSERT INTO public.credit_transactions(user_id, type, amount, balance_after, reference_type, reference_id, metadata, status)
    VALUES (_user_id, _type, _amount, w.plan_credits + w.topup_credits, _reference_type, _reference_id,
            COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('bucket', _bucket), 'completed')
    RETURNING id INTO v_tx;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate: roll back the wallet increment and return existing.
    IF _bucket = 'plan' THEN
      UPDATE public.credit_wallets
         SET plan_credits = plan_credits - _amount, updated_at = now()
       WHERE user_id = _user_id
       RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
    ELSE
      UPDATE public.credit_wallets
         SET topup_credits = topup_credits - _amount, updated_at = now()
       WHERE user_id = _user_id
       RETURNING plan_credits, topup_credits INTO w.plan_credits, w.topup_credits;
    END IF;
    SELECT id INTO v_tx
      FROM public.credit_transactions
     WHERE user_id = _user_id AND type = _type AND status = 'completed' AND reference_id = _reference_id
     LIMIT 1;
  END;

  plan_credits := w.plan_credits; topup_credits := w.topup_credits; balance := w.plan_credits + w.topup_credits; tx_id := v_tx;
  RETURN NEXT;
END;
$function$;

-- Simplified Users and Projects tables as requested
CREATE TYPE public.user_plan_tier AS ENUM ('editor', 'creator', 'studio');

CREATE TABLE IF NOT EXISTS public.simplified_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    current_plan public.user_plan_tier NOT NULL DEFAULT 'editor',
    credits INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simplified_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.simplified_users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    srt_data TEXT,
    status TEXT NOT NULL DEFAULT 'uploading',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.simplified_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON public.simplified_users FOR SELECT USING (auth.uid() = id);

ALTER TABLE public.simplified_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own projects" ON public.simplified_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.simplified_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.simplified_projects FOR UPDATE USING (auth.uid() = user_id);
-- ============================================
-- CREDIT RATES (admin editable)
-- ============================================
CREATE TABLE credit_rates (
  feature          text PRIMARY KEY,
  credits_per_unit numeric NOT NULL,
  unit             text NOT NULL DEFAULT 'minute',
  description      text,
  updated_at       timestamptz DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

-- Seed default rates
INSERT INTO credit_rates (feature, credits_per_unit, unit, description) VALUES
  ('transcription',      1,  'minute', '1 credit per minute of video transcribed'),
  ('caption_burn',       2,  'minute', '2 credits per minute for burning captions'),
  ('ai_dubbing',         5,  'minute', '5 credits per minute for AI dubbing'),
  ('tts',                2,  'minute', '2 credits per minute of TTS output'),
  ('voice_clone',        3,  'minute', '3 credits per minute of cloned voice'),
  ('audio_enhancement',  1,  'minute', '1 credit per minute of audio'),
  ('lip_sync',           10, 'video',  '10 credits flat per lip sync video'),
  ('avatar_generation',  5,  'image',  '5 credits flat per avatar image'),
  ('video_generation',   20, 'video',  '20 credits flat per generated video'),
  ('background_removal', 2,  'image',  '2 credits flat per image'),
  ('translation',        1,  'minute', '1 credit per minute of transcript translated');

-- ============================================
-- PLAN LIMITS (admin editable)
-- ============================================
CREATE TABLE plan_limits (
  plan                  text PRIMARY KEY,
  display_name          text NOT NULL,
  monthly_credits       integer NOT NULL,
  max_video_minutes     integer NOT NULL,
  max_file_size_mb      integer NOT NULL,
  storage_gb            integer NOT NULL,
  max_team_members      integer NOT NULL DEFAULT 1,
  can_burn_captions     boolean NOT NULL DEFAULT false,
  can_dub               boolean NOT NULL DEFAULT false,
  can_clone_voice       boolean NOT NULL DEFAULT false,
  can_lip_sync          boolean NOT NULL DEFAULT false,
  can_generate_video    boolean NOT NULL DEFAULT false,
  can_use_api           boolean NOT NULL DEFAULT false,
  can_audio_only_upload boolean NOT NULL DEFAULT false,
  can_green_screen      boolean NOT NULL DEFAULT false,
  can_upload_custom_font boolean NOT NULL DEFAULT false,
  max_export_resolution text NOT NULL DEFAULT '720p',
  max_export_fps        integer NOT NULL DEFAULT 30,
  watermark_forced      boolean NOT NULL DEFAULT true,
  priority_render       boolean NOT NULL DEFAULT false,
  updated_at            timestamptz DEFAULT now(),
  updated_by            uuid REFERENCES auth.users(id)
);

INSERT INTO plan_limits VALUES
  ('free',    'Free',    60,   2,   500,    5,   1,  false, false, false, false, false, false, false, false, false, '720p',  30, true,  false),
  ('editor',  'Editor',  300,  10,  2000,   20,  1,  true,  false, false, false, false, false, false, false, true,  '1080p', 30, false, false),
  ('creator', 'Creator', 1000, 30,  10000,  60,  3,  true,  true,  true,  true,  false, false, true,  true,  true,  '4k',    60, false, false),
  ('studio',  'Studio',  5000, 999, 999999, 150, 999,true,  true,  true,  true,  true,  true,  true,  true,  true,  '4k',    60, false, true);

-- ============================================
-- PLAN PRICING (admin editable)
-- ============================================
CREATE TABLE plan_pricing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan                text NOT NULL REFERENCES plan_limits(plan),
  currency            text NOT NULL, -- 'INR' or 'USD'
  monthly_price       numeric NOT NULL,
  yearly_price        numeric NOT NULL, -- per month when billed yearly
  yearly_total        numeric NOT NULL, -- total yearly charge
  original_monthly    numeric,          -- strikethrough price
  original_yearly     numeric,          -- strikethrough yearly
  razorpay_plan_id_monthly text,
  razorpay_plan_id_yearly  text,
  stripe_price_id_monthly  text,
  stripe_price_id_yearly   text,
  is_active           boolean DEFAULT true,
  updated_at          timestamptz DEFAULT now(),
  updated_by          uuid REFERENCES auth.users(id),
  UNIQUE(plan, currency)
);

INSERT INTO plan_pricing (plan, currency, monthly_price, yearly_price, yearly_total, original_monthly, original_yearly) VALUES
  ('editor',  'INR', 499,  416,  4992,  670,  558),
  ('creator', 'INR', 999,  833,  9996,  1250, 1042),
  ('studio',  'INR', 2599, 2166, 25992, 3400, 2833),
  ('editor',  'USD', 6,    5,    60,    8,    7),
  ('creator', 'USD', 12,   10,   120,   15,   12),
  ('studio',  'USD', 30,   25,   300,   40,   33);

-- ============================================
-- FEATURE FLAGS (admin editable)
-- ============================================
CREATE TABLE feature_flags (
  feature_name         text PRIMARY KEY,
  display_name         text NOT NULL,
  description          text,
  enabled_global       boolean NOT NULL DEFAULT true,
  enabled_plans        text[] DEFAULT '{}', -- empty = all plans
  is_beta              boolean DEFAULT false,
  updated_at           timestamptz DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id)
);

INSERT INTO feature_flags (feature_name, display_name, description, enabled_global, enabled_plans) VALUES
  ('transcription',      'Transcription',        'AI video transcription',          true, '{}'),
  ('caption_editor',     'Caption Editor',       'Visual caption editor',           true, '{}'),
  ('ai_dubbing',         'AI Dubbing',           'Dub video in any language',       true, '{creator,studio}'),
  ('voice_cloning',      'Voice Cloning',        'Clone voice from sample',         true, '{creator,studio}'),
  ('lip_sync',           'Lip Sync Avatar',      'Talking head generation',         true, '{creator,studio}'),
  ('video_generation',   'Video Generation',     'AI video generation',             true, '{studio}'),
  ('avatar_generation',  'Avatar Generation',    'AI avatar image generation',      true, '{creator,studio}'),
  ('background_removal', 'Background Removal',   'Remove image background',         true, '{}'),
  ('audio_enhancement',  'Audio Enhancement',    'Denoise and enhance audio',       true, '{}'),
  ('translation',        'Caption Translation',  'Translate captions to any lang',  true, '{}'),
  ('team_collab',        'Team Collaboration',   'Invite team members',             true, '{creator,studio}'),
  ('api_access',         'API Access',           'REST API for developers',         true, '{studio}'),
  ('green_screen',       'Green Screen',         'Chroma key export',               true, '{creator,studio}'),
  ('srt_export',         'SRT Export',           'Export SRT subtitle files',       true, '{}'),
  ('tts',                'Text to Speech',       'AI text to speech',               true, '{editor,creator,studio}');

-- ============================================
-- SYSTEM SETTINGS (admin editable)
-- ============================================
CREATE TABLE system_settings (
  key          text PRIMARY KEY,
  value        jsonb NOT NULL,
  description  text,
  updated_at   timestamptz DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id)
);

INSERT INTO system_settings (key, value, description) VALUES
  ('maintenance_mode',      'false',                       'Show maintenance page to all users'),
  ('announcement_bar',      '{"enabled": false, "text": "", "type": "info", "link": "", "link_text": ""}', 'Top banner shown on all pages'),
  ('max_upload_size_mb',    '500',                         'Maximum file upload size in MB'),
  ('watermark_text',        '"Yourcaptions.in"',          'Watermark text on free plan exports'),
  ('free_trial_credits',    '60',                          'Credits given on signup'),
  ('referral_credits',      '50',                          'Credits given for referral'),
  ('support_email',         '"support@Yourcaptions.in"',  'Support contact email'),
  ('min_app_version',       '"1.0.0"',                     'Minimum required app version');

-- ============================================
-- ADMIN AUDIT LOG (every admin action logged)
-- ============================================
CREATE TABLE admin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id),
  admin_email  text NOT NULL,
  action       text NOT NULL,
  target_type  text, -- 'user', 'setting', 'credit_rate', 'plan', 'feature_flag'
  target_id    text,
  old_value    jsonb,
  new_value    jsonb,
  ip_address   text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- credit_rates: public read, admin write only
ALTER TABLE credit_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_rates_read" ON credit_rates FOR SELECT USING (true);
CREATE POLICY "credit_rates_admin" ON credit_rates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- plan_limits: public read, admin write only
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_limits_read" ON plan_limits FOR SELECT USING (true);
CREATE POLICY "plan_limits_admin" ON plan_limits FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- plan_pricing: public read, admin write only
ALTER TABLE plan_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_pricing_read" ON plan_pricing FOR SELECT USING (true);
CREATE POLICY "plan_pricing_admin" ON plan_pricing FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- feature_flags: public read, admin write only
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags_admin" ON feature_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- system_settings: public read, admin write only
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_read" ON system_settings FOR SELECT USING (true);
CREATE POLICY "system_settings_admin" ON system_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- admin_audit_log: admin read only
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin" ON admin_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- ============================================
-- TRIGGER: Update updated_at on all admin tables
-- ============================================
CREATE OR REPLACE FUNCTION update_admin_table_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION update_admin_table_timestamp FROM PUBLIC;

CREATE TRIGGER credit_rates_timestamp BEFORE UPDATE ON credit_rates FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
CREATE TRIGGER plan_limits_timestamp BEFORE UPDATE ON plan_limits FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
CREATE TRIGGER plan_pricing_timestamp BEFORE UPDATE ON plan_pricing FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
CREATE TRIGGER feature_flags_timestamp BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
CREATE TRIGGER system_settings_timestamp BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
-- Fix missing GRANT statements for admin tables introduced in 20260806000000_admin_controls.sql
-- Without these grants, the tables are missing from the PostgREST schema cache and cannot be queried.

GRANT SELECT ON public.credit_rates TO authenticated;
GRANT ALL ON public.credit_rates TO service_role;

GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;

GRANT SELECT ON public.plan_pricing TO authenticated;
GRANT ALL ON public.plan_pricing TO service_role;

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

GRANT ALL ON public.admin_audit_log TO service_role;

-- Force a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
