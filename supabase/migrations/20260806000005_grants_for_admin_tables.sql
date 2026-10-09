-- Grant access to admin tables for anon and authenticated users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_rates') THEN
    GRANT SELECT ON public.credit_rates TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_limits') THEN
    GRANT SELECT ON public.plan_limits TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_pricing') THEN
    GRANT SELECT ON public.plan_pricing TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feature_flags') THEN
    GRANT SELECT ON public.feature_flags TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN
    GRANT SELECT ON public.system_settings TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_audit_log') THEN
    GRANT SELECT ON public.admin_audit_log TO authenticated;
  END IF;
END $$;

