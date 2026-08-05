
CREATE OR REPLACE FUNCTION public.auto_grant_admin_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowlist text[] := ARRAY['saifyautomates@gmail.com','jackxparrowww@gmail.com'];
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) = ANY(allowlist) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_allowlist ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_allowlist
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_allowlist();

-- Backfill: grant admin to any existing account matching the allowlist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('saifyautomates@gmail.com','jackxparrowww@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
