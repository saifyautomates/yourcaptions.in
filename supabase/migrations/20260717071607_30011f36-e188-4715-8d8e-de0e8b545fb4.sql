
-- Enum for team roles
DO $$ BEGIN
  CREATE TYPE public.team_role AS ENUM ('owner','admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX team_members_user_idx ON public.team_members(user_id);
CREATE INDEX team_members_team_idx ON public.team_members(team_id);

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.team_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);
CREATE INDEX team_invitations_email_idx ON public.team_invitations(lower(email));

-- Optional team on projects
ALTER TABLE public.projects ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX projects_team_idx ON public.projects(team_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_invitations TO service_role;

-- Security-definer helpers (avoid recursive RLS on team_members)
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.team_role_of(_team_id uuid, _user_id uuid)
RETURNS public.team_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.team_role_of(_team_id, _user_id) IN ('owner','admin');
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid();
$$;

-- Auto-add owner as member on team insert
CREATE OR REPLACE FUNCTION public.attach_team_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_attach_owner
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.attach_team_owner();

-- updated_at trigger
CREATE TRIGGER teams_set_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- teams policies
CREATE POLICY "Members see their teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Users create teams they own" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Managers update team" ON public.teams FOR UPDATE TO authenticated
  USING (public.can_manage_team(id, auth.uid()))
  WITH CHECK (public.can_manage_team(id, auth.uid()));

CREATE POLICY "Owners delete team" ON public.teams FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- team_members policies
CREATE POLICY "Members see co-members" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Managers or self insert member" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Managers change roles" ON public.team_members FOR UPDATE TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner')
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner');

CREATE POLICY "Manager remove or self leave" ON public.team_members FOR DELETE TO authenticated
  USING (
    (public.can_manage_team(team_id, auth.uid()) AND role <> 'owner')
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- team_invitations policies
CREATE POLICY "Managers see invitations" ON public.team_invitations FOR SELECT TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()) OR lower(email) = public.current_user_email());

CREATE POLICY "Managers invite" ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(team_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Managers revoke invitations" ON public.team_invitations FOR DELETE TO authenticated
  USING (public.can_manage_team(team_id, auth.uid()));

-- Accept invitation RPC
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.team_invitations%rowtype;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = 'P0001';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM public.team_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE='P0001'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already accepted' USING ERRCODE='P0001'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation expired' USING ERRCODE='P0001'; END IF;
  IF lower(v_inv.email) <> v_email THEN RAISE EXCEPTION 'invitation email mismatch' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_inv.team_id, auth.uid(), v_inv.role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.team_invitations SET accepted_at = now() WHERE id = v_inv.id;
  RETURN v_inv.team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

-- List invitations for current signed-in user's email
CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE (
  id uuid, team_id uuid, team_name text, role public.team_role,
  token text, expires_at timestamptz, invited_by uuid, invited_by_name text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.team_id, t.name, i.role, i.token, i.expires_at, i.invited_by, p.full_name
  FROM public.team_invitations i
  JOIN public.teams t ON t.id = i.team_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.accepted_at IS NULL
    AND i.expires_at > now()
    AND lower(i.email) = public.current_user_email();
$$;
REVOKE ALL ON FUNCTION public.my_pending_invitations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;

-- Update projects RLS: team members can see team projects
DROP POLICY IF EXISTS "Users manage their projects" ON public.projects;
CREATE POLICY "Owner or team member sees project" ON public.projects FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Owner inserts project" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or team editor updates project" ON public.projects FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.team_role_of(team_id, auth.uid()) IN ('owner','admin','editor'))
  );
CREATE POLICY "Owner or team manager deletes project" ON public.projects FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.can_manage_team(team_id, auth.uid()))
  );
