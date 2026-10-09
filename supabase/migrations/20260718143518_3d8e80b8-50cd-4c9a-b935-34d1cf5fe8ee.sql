
-- 1) Grant admin role to owner (if user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT '64f73634-1f54-4cd6-83f4-b57d709747c5', 'admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '64f73634-1f54-4cd6-83f4-b57d709747c5')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Protect owner admin row from deletion / role change
CREATE OR REPLACE FUNCTION public.protect_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.user_id = '64f73634-1f54-4cd6-83f4-b57d709747c5' AND OLD.role = 'admin') THEN
    RAISE EXCEPTION 'owner admin cannot be removed';
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.user_id = '64f73634-1f54-4cd6-83f4-b57d709747c5' AND OLD.role = 'admin' AND NEW.role <> 'admin') THEN
    RAISE EXCEPTION 'owner admin role cannot be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_admin_trg ON public.user_roles;
CREATE TRIGGER protect_owner_admin_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_owner_admin();

-- 3) admin_set_role: grant or revoke a role for a user (by id or email)
CREATE OR REPLACE FUNCTION public.admin_set_role(
  _user_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _role app_role DEFAULT 'admin',
  _grant boolean DEFAULT true
)
RETURNS TABLE(user_id uuid, role app_role, granted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := _user_id;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NULL AND _email IS NOT NULL THEN
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0001';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
    user_id := v_uid; role := _role; granted := true; RETURN NEXT;
  ELSE
    DELETE FROM public.user_roles WHERE user_roles.user_id = v_uid AND user_roles.role = _role;
    user_id := v_uid; role := _role; granted := false; RETURN NEXT;
  END IF;
END;
$$;

-- 4) admin_list_users: enriched listing with email + admin flag
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, full_name text, plan plan_tier, credits_seconds integer, is_admin boolean, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, u.email, p.full_name, p.plan, p.credits_seconds,
         EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin') AS is_admin,
         p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC NULLS LAST;
$$;
