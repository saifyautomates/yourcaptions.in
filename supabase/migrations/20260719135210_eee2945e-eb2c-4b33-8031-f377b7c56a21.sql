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
GRANT EXECUTE ON FUNCTION public.team_role_of(uuid, uuid) TO authenticated, service_role;