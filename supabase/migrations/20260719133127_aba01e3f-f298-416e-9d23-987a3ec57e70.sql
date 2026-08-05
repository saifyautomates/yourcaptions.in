
-- Fix 1: Allow team members to view captions for team-shared projects
CREATE POLICY "Team members can view shared project captions"
ON public.captions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = captions.project_id
      AND p.team_id IS NOT NULL
      AND public.is_team_member(p.team_id, auth.uid())
  )
);

-- Fix 2: Create a token-free view for invitees; restrict base table SELECT for invitees
-- Drop old broad SELECT policy and split into managers-only + no invitee direct access to base table
DROP POLICY IF EXISTS "Managers see invitations" ON public.team_invitations;

CREATE POLICY "Managers see invitations"
ON public.team_invitations FOR SELECT
USING (public.can_manage_team(team_id, auth.uid()));

-- Invitees should use the my_pending_invitations() RPC (already exists, security definer)
-- which returns the token only to the matching email. No direct base-table access needed.
