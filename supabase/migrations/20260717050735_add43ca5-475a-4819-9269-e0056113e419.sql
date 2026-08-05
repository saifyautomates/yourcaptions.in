
REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_record_usage(uuid, text, int, int, int) FROM authenticated;
