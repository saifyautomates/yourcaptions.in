
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
