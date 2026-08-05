-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated/PUBLIC.
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