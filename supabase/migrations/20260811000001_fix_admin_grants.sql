-- Fix missing GRANT statements for admin tables introduced in 20260806000000_admin_controls.sql
-- Without these grants, the tables are missing from the PostgREST schema cache and cannot be queried.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_rates') THEN
    GRANT SELECT ON public.credit_rates TO authenticated;
    GRANT ALL ON public.credit_rates TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_limits') THEN
    GRANT SELECT ON public.plan_limits TO authenticated;
    GRANT ALL ON public.plan_limits TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_pricing') THEN
    GRANT SELECT ON public.plan_pricing TO authenticated;
    GRANT ALL ON public.plan_pricing TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feature_flags') THEN
    GRANT SELECT ON public.feature_flags TO authenticated;
    GRANT ALL ON public.feature_flags TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN
    GRANT SELECT ON public.system_settings TO authenticated;
    GRANT ALL ON public.system_settings TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_audit_log') THEN
    GRANT ALL ON public.admin_audit_log TO service_role;
  END IF;
END $$;

-- Force a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';

