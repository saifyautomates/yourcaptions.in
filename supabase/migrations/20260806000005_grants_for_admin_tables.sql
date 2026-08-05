-- Grant access to admin tables for anon and authenticated users
GRANT SELECT ON public.credit_rates TO authenticated, anon;
GRANT SELECT ON public.plan_limits TO authenticated, anon;
GRANT SELECT ON public.plan_pricing TO authenticated, anon;
GRANT SELECT ON public.feature_flags TO authenticated, anon;
GRANT SELECT ON public.system_settings TO authenticated, anon;
GRANT SELECT ON public.admin_audit_log TO authenticated;
