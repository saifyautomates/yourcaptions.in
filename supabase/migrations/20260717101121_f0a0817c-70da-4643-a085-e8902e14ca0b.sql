
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
