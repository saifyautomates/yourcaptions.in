-- Lock down SECURITY DEFINER functions so anonymous/public roles cannot execute them.
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
