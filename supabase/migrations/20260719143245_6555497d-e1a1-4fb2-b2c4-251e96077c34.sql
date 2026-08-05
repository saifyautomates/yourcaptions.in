
REVOKE EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_owner_admin() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, app_role, boolean) TO authenticated;
