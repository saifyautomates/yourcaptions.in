-- Fix missing GRANT statements for admin tables introduced in 20260806000000_admin_controls.sql
-- Without these grants, the tables are missing from the PostgREST schema cache and cannot be queried.

GRANT SELECT ON public.credit_rates TO authenticated;
GRANT ALL ON public.credit_rates TO service_role;

GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;

GRANT SELECT ON public.plan_pricing TO authenticated;
GRANT ALL ON public.plan_pricing TO service_role;

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

GRANT ALL ON public.admin_audit_log TO service_role;

-- Force a schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';
