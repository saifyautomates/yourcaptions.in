
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
