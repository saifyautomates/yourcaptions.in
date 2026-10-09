-- 20260806000001_restore_admin_rpcs.sql
-- COMPLETE ADMIN RPC RESTORATION MIGRATION

-- ============ has_role Helper ============
DROP FUNCTION IF EXISTS public.has_role(uuid, text);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role::text = _role
  )
$$;

-- ============ log_admin_access_attempt ============
DROP FUNCTION IF EXISTS public.log_admin_access_attempt(text, boolean, text);
DROP FUNCTION IF EXISTS public.log_admin_access_attempt;
CREATE OR REPLACE FUNCTION public.log_admin_access_attempt(_email text, _success boolean, _ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_email, action, success, ip_address, created_at)
  VALUES (_email, 'admin_access', _success, _ip, now());
EXCEPTION WHEN OTHERS THEN
  -- ignore missing table errors
  NULL;
END;
$$;

-- ============ admin_get_user_by_email ============
DROP FUNCTION IF EXISTS public.admin_get_user_by_email(text);
DROP FUNCTION IF EXISTS public.admin_get_user_by_email;
CREATE OR REPLACE FUNCTION public.admin_get_user_by_email(user_email text)
RETURNS TABLE (id uuid, email text, full_name text, total_credits integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email, p.full_name, p.credits_seconds as total_credits
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE u.email = user_email
  AND public.has_role(auth.uid(), 'admin')
  LIMIT 1;
$$;

-- ============ admin_usage_summary ============
DROP FUNCTION IF EXISTS public.admin_usage_summary(timestamptz);
DROP FUNCTION IF EXISTS public.admin_usage_summary();
DROP FUNCTION IF EXISTS public.admin_usage_summary;
CREATE OR REPLACE FUNCTION public.admin_usage_summary(_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE (
  user_id uuid, full_name text, plan text, credits_seconds int,
  transcribe_count bigint, dub_count bigint, translate_count bigint,
  total_events bigint, caption_seconds_used bigint,
  dub_seconds_used bigint, export_count_used bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.full_name, p.plan::text, p.credits_seconds,
    0::bigint AS transcribe_count,
    0::bigint AS dub_count,
    0::bigint AS translate_count,
    0::bigint AS total_events,
    0::bigint AS caption_seconds_used,
    0::bigint AS dub_seconds_used,
    0::bigint AS export_count_used
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC NULLS LAST;
$$;

-- ============ admin_list_users ============
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.admin_list_users;
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, full_name text, plan text, credits_seconds integer, is_admin boolean, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, u.email, p.full_name, p.plan::text, p.credits_seconds,
         EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role::text = 'admin') AS is_admin,
         p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC NULLS LAST;
$$;

-- ============ admin_set_role ============
DROP FUNCTION IF EXISTS public.admin_set_role(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS public.admin_set_role;
CREATE OR REPLACE FUNCTION public.admin_set_role(
  _user_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _role text DEFAULT 'admin',
  _grant boolean DEFAULT true
)
RETURNS TABLE(user_id uuid, role text, granted boolean)
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
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, _role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    user_id := v_uid; role := _role; granted := true; RETURN NEXT;
  ELSE
    DELETE FROM public.user_roles WHERE public.user_roles.user_id = v_uid AND public.user_roles.role::text = _role;
    user_id := v_uid; role := _role; granted := false; RETURN NEXT;
  END IF;
END;
$$;

-- ============ admin_list_projects ============
DROP FUNCTION IF EXISTS public.admin_list_projects(int, int, text, text);
DROP FUNCTION IF EXISTS public.admin_list_projects;
CREATE OR REPLACE FUNCTION public.admin_list_projects(_limit int DEFAULT 50, _offset int DEFAULT 0, _status text DEFAULT NULL, _search text DEFAULT NULL)
RETURNS TABLE(
  id uuid, title text, status text, duration_seconds int,
  created_at timestamptz, user_id uuid, owner_email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.status::text, p.duration_seconds, p.created_at, p.user_id, u.email
    FROM public.projects p
    LEFT JOIN auth.users u ON u.id = p.user_id
   WHERE public.has_role(auth.uid(), 'admin')
     AND (_status IS NULL OR p.status::text = _status)
     AND (_search IS NULL OR p.title ILIKE '%' || _search || '%' OR u.email ILIKE '%' || _search || '%')
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200))
   OFFSET GREATEST(_offset, 0);
$$;

-- ============ admin_grant_access ============
DROP FUNCTION IF EXISTS public.admin_grant_access(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.admin_grant_access(uuid, public.plan_tier, integer, text);
DROP FUNCTION IF EXISTS public.admin_grant_access;
CREATE OR REPLACE FUNCTION public.admin_grant_access(
  _user_id uuid,
  _plan text DEFAULT NULL,
  _credits_seconds integer DEFAULT NULL,
  _mode text DEFAULT 'add'
)
RETURNS TABLE(user_id uuid, plan text, credits_seconds integer)
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
  
  UPDATE public.profiles p
     SET plan = COALESCE(_plan::public.plan_tier, p.plan),
         credits_seconds = CASE
           WHEN _credits_seconds IS NULL THEN p.credits_seconds
           WHEN _mode = 'set' THEN GREATEST(_credits_seconds, 0)
           ELSE GREATEST(COALESCE(p.credits_seconds,0) + _credits_seconds, 0)
         END,
         updated_at = now()
   WHERE p.id = _user_id
   RETURNING p.id, p.plan::text, p.credits_seconds
     INTO user_id, plan, credits_seconds;
     
  RETURN NEXT;
END;
$$;

-- ============ admin_subscriptions_summary ============
DROP FUNCTION IF EXISTS public.admin_subscriptions_summary();
DROP FUNCTION IF EXISTS public.admin_subscriptions_summary;
CREATE OR REPLACE FUNCTION public.admin_subscriptions_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_start_30 timestamptz := v_now - interval '30 days';
  v_mrr_paise bigint := 0;
  v_paid_users int := 0;
  v_churned int := 0;
  v_new_paid int := 0;
  v_revenue_series jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  
  BEGIN
    SELECT COALESCE(SUM(amount_paise),0) INTO v_mrr_paise
      FROM public.payments
     WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_30;
  EXCEPTION WHEN undefined_table THEN
    v_mrr_paise := 0;
  END;

  BEGIN
    SELECT count(DISTINCT user_id) INTO v_paid_users
      FROM public.subscriptions WHERE status = 'active';
    SELECT count(*) INTO v_churned
      FROM public.subscriptions
     WHERE status IN ('cancelled','canceled') AND created_at >= v_start_30;
    SELECT count(*) INTO v_new_paid
      FROM public.subscriptions
     WHERE status = 'active' AND created_at >= v_start_30;
  EXCEPTION WHEN undefined_table THEN
    v_paid_users := 0;
    v_churned := 0;
    v_new_paid := 0;
  END;

  RETURN jsonb_build_object(
    'mrr_paise', v_mrr_paise,
    'paid_users', v_paid_users,
    'churned', v_churned,
    'new_paid', v_new_paid,
    'revenue_series', v_revenue_series
  );
END;
$$;

-- ============ admin_security_alerts ============
DROP FUNCTION IF EXISTS public.admin_security_alerts(int);
DROP FUNCTION IF EXISTS public.admin_security_alerts;
CREATE OR REPLACE FUNCTION public.admin_security_alerts(_limit int DEFAULT 100)
RETURNS TABLE(id uuid, type text, severity text, description text, created_at timestamptz, resolved boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  
  RETURN QUERY 
  SELECT f.id, f.finding_type::text, f.severity::text, f.description, f.created_at, f.resolved
  FROM public.security_findings f
  ORDER BY f.created_at DESC
  LIMIT _limit;
EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

-- ============ admin_delete_user ============
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
DROP FUNCTION IF EXISTS public.admin_delete_user;
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
END;
$$;

-- ============ admin_overview_stats ============
DROP FUNCTION IF EXISTS public.admin_overview_stats();
DROP FUNCTION IF EXISTS public.admin_overview_stats;
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_start_30 timestamptz := v_now - interval '30 days';
  v_start_60 timestamptz := v_start_30 - interval '30 days';
  v_total_users int := 0;
  v_users_30 int := 0;
  v_users_prev int := 0;
  v_active_projects int := 0;
  v_projects_30 int := 0;
  v_projects_prev int := 0;
  v_total_exports int := 0;
  v_exports_30 int := 0;
  v_exports_prev int := 0;
  v_revenue_30 bigint := 0;
  v_revenue_prev bigint := 0;
  v_signups_series jsonb := '[]'::jsonb;
  v_projects_series jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_users FROM public.profiles;
  SELECT count(*) INTO v_users_30 FROM public.profiles WHERE created_at >= v_start_30;
  SELECT count(*) INTO v_users_prev FROM public.profiles WHERE created_at >= v_start_60 AND created_at < v_start_30;
  
  SELECT count(*) INTO v_active_projects FROM public.projects WHERE status::text <> 'failed';
  SELECT count(*) INTO v_projects_30 FROM public.projects WHERE created_at >= v_start_30;
  SELECT count(*) INTO v_projects_prev FROM public.projects WHERE created_at >= v_start_60 AND created_at < v_start_30;

  BEGIN
    SELECT count(*) INTO v_total_exports FROM public.export_metrics WHERE outcome = 'success';
    SELECT count(*) INTO v_exports_30 FROM public.export_metrics WHERE outcome = 'success' AND created_at >= v_start_30;
    SELECT count(*) INTO v_exports_prev FROM public.export_metrics WHERE outcome = 'success' AND created_at >= v_start_60 AND created_at < v_start_30;
  EXCEPTION WHEN undefined_table THEN
    v_total_exports := 0; v_exports_30 := 0; v_exports_prev := 0;
  END;

  BEGIN
    SELECT COALESCE(SUM(amount_paise),0) INTO v_revenue_30 FROM public.payments WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_30;
    SELECT COALESCE(SUM(amount_paise),0) INTO v_revenue_prev FROM public.payments WHERE status IN ('captured','paid','succeeded') AND created_at >= v_start_60 AND created_at < v_start_30;
  EXCEPTION WHEN undefined_table THEN
    v_revenue_30 := 0; v_revenue_prev := 0;
  END;

  SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c, 0)) ORDER BY d)
    INTO v_signups_series
    FROM generate_series(v_start_30::date, v_now::date, interval '1 day') d
    LEFT JOIN (SELECT date_trunc('day', created_at)::date AS day, count(*) AS c FROM public.profiles WHERE created_at >= v_start_30 GROUP BY 1) s ON s.day = d::date;

  SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c, 0)) ORDER BY d)
    INTO v_projects_series
    FROM generate_series(v_start_30::date, v_now::date, interval '1 day') d
    LEFT JOIN (SELECT date_trunc('day', created_at)::date AS day, count(*) AS c FROM public.projects WHERE created_at >= v_start_30 GROUP BY 1) s ON s.day = d::date;

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
END;
$$;

-- ============ admin_recent_activity ============
DROP FUNCTION IF EXISTS public.admin_recent_activity(int);
DROP FUNCTION IF EXISTS public.admin_recent_activity;
CREATE OR REPLACE FUNCTION public.admin_recent_activity(_limit int DEFAULT 20)
RETURNS TABLE(id uuid, user_id uuid, email text, action_type text, metadata jsonb, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, a.user_id, u.email, a.action_type, a.metadata, a.created_at
    FROM public.activity_log a
    LEFT JOIN auth.users u ON u.id = a.user_id
   ORDER BY a.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
EXCEPTION WHEN undefined_table THEN
  RETURN;
END;
$$;

-- ============ admin_update_setting ============
DROP FUNCTION IF EXISTS public.admin_update_setting(text, jsonb);
DROP FUNCTION IF EXISTS public.admin_update_setting;
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
  
  BEGIN
    INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
    VALUES (_key, _value, now(), auth.uid())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN _value;
END;
$$;

-- Apply permissions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_usage_summary(timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_projects(int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(int, int, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_grant_access(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, text, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_subscriptions_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_subscriptions_summary() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_security_alerts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_security_alerts(int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_overview_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_recent_activity(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) TO authenticated;
