
-- ============================================================
-- Security audit log for admin role changes + admin-route access
-- ============================================================
CREATE TYPE public.security_audit_kind AS ENUM (
  'role_granted',
  'role_revoked',
  'admin_access_denied',
  'admin_access_ok'
);

CREATE TABLE public.security_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          public.security_audit_kind NOT NULL,
  actor_id      uuid,               -- who performed the action (auth.uid())
  subject_id    uuid,               -- user affected (for role changes)
  role          public.app_role,
  path          text,               -- route path for access-denied events
  suspicious    boolean NOT NULL DEFAULT false,
  reason        text,               -- why we flagged it (rate/self-grant/…)
  user_agent    text,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_audit_log_created_at_idx
  ON public.security_audit_log (created_at DESC);
CREATE INDEX security_audit_log_suspicious_idx
  ON public.security_audit_log (suspicious, created_at DESC);
CREATE INDEX security_audit_log_actor_idx
  ON public.security_audit_log (actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log
CREATE POLICY "Admins read security audit"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Any signed-in user can insert an event, but only about themselves as actor.
-- This lets the client-side AdminRoute guard record denied attempts.
CREATE POLICY "Users log their own security events"
  ON public.security_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- Role change audit trigger
-- Logs INSERTs (grants) and DELETEs (revokes) on user_roles
-- and flags them suspicious when:
--   * the actor grants/revokes their own role (self-service escalation), OR
--   * >5 role changes by the same actor within the last 10 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_kind  public.security_audit_kind;
  v_subject uuid;
  v_role  public.app_role;
  v_recent int;
  v_suspicious boolean := false;
  v_reason text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_kind := 'role_granted';
    v_subject := NEW.user_id;
    v_role := NEW.role;
  ELSIF TG_OP = 'DELETE' THEN
    v_kind := 'role_revoked';
    v_subject := OLD.user_id;
    v_role := OLD.role;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Self-modification of a privileged role is always suspicious
  IF v_actor IS NOT NULL AND v_actor = v_subject AND v_role IN ('admin','moderator') THEN
    v_suspicious := true;
    v_reason := 'self_role_change';
  END IF;

  -- Burst detection: >5 role changes in 10 minutes by same actor
  IF v_actor IS NOT NULL THEN
    SELECT count(*) INTO v_recent
      FROM public.security_audit_log
     WHERE actor_id = v_actor
       AND kind IN ('role_granted','role_revoked')
       AND created_at > now() - interval '10 minutes';
    IF v_recent >= 5 THEN
      v_suspicious := true;
      v_reason := COALESCE(v_reason || '+', '') || 'burst_role_changes';
    END IF;
  END IF;

  INSERT INTO public.security_audit_log
    (kind, actor_id, subject_id, role, suspicious, reason, context)
  VALUES
    (v_kind, v_actor, v_subject, v_role, v_suspicious, v_reason,
     jsonb_build_object('op', TG_OP));

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

-- ============================================================
-- RPC: log an admin-route access attempt (called by AdminRoute)
-- Flags suspicious when the same non-admin user has been denied
-- 3+ times in the last 10 minutes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_access_attempt(
  _path text,
  _allowed boolean,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_recent int;
  v_susp boolean := false;
  v_reason text := NULL;
  v_kind public.security_audit_kind;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = 'P0001';
  END IF;

  v_kind := CASE WHEN _allowed THEN 'admin_access_ok' ELSE 'admin_access_denied' END;

  IF NOT _allowed THEN
    SELECT count(*) INTO v_recent
      FROM public.security_audit_log
     WHERE actor_id = v_uid
       AND kind = 'admin_access_denied'
       AND created_at > now() - interval '10 minutes';
    IF v_recent >= 2 THEN  -- this attempt is the 3rd
      v_susp := true;
      v_reason := 'repeated_admin_denial';
    END IF;
  END IF;

  INSERT INTO public.security_audit_log
    (kind, actor_id, subject_id, path, suspicious, reason, user_agent)
  VALUES
    (v_kind, v_uid, v_uid, _path, v_susp, v_reason, _user_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_access_attempt(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, text) TO authenticated;

-- ============================================================
-- Admin summary view
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_security_alerts(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, kind public.security_audit_kind, actor_id uuid, actor_email text,
  subject_id uuid, subject_email text, role public.app_role, path text,
  suspicious boolean, reason text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.kind, s.actor_id, ua.email, s.subject_id, us.email,
         s.role, s.path, s.suspicious, s.reason, s.created_at
    FROM public.security_audit_log s
    LEFT JOIN auth.users ua ON ua.id = s.actor_id
    LEFT JOIN auth.users us ON us.id = s.subject_id
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY s.created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

REVOKE ALL ON FUNCTION public.admin_security_alerts(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_alerts(int) TO authenticated;
