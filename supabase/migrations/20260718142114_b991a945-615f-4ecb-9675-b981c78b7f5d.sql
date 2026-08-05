
CREATE OR REPLACE FUNCTION public.admin_grant_access(
  _user_id uuid,
  _plan plan_tier DEFAULT NULL,
  _credits_seconds integer DEFAULT NULL,
  _mode text DEFAULT 'add'  -- 'add' or 'set'
)
RETURNS TABLE(user_id uuid, plan plan_tier, credits_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = 'P0001';
  END IF;
  IF _mode NOT IN ('add','set') THEN
    RAISE EXCEPTION 'invalid mode' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles p
     SET plan = COALESCE(_plan, p.plan),
         credits_seconds = CASE
           WHEN _credits_seconds IS NULL THEN p.credits_seconds
           WHEN _mode = 'set' THEN GREATEST(_credits_seconds, 0)
           ELSE GREATEST(COALESCE(p.credits_seconds,0) + _credits_seconds, 0)
         END,
         updated_at = now()
   WHERE p.id = _user_id
   RETURNING p.id, p.plan, p.credits_seconds
     INTO user_id, plan, credits_seconds;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_access(uuid, plan_tier, integer, text) TO authenticated;
