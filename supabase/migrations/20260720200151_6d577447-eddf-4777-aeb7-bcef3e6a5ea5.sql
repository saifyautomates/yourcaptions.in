CREATE OR REPLACE FUNCTION public.increment_credits_seconds(target_user UUID, add_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total INTEGER;
BEGIN
  UPDATE public.profiles
     SET credits_seconds = COALESCE(credits_seconds, 0) + add_seconds
   WHERE id = target_user
   RETURNING credits_seconds INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_credits_seconds(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_credits_seconds(UUID, INTEGER) TO service_role;