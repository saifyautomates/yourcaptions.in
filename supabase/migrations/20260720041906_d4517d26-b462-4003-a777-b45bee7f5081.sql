DROP POLICY IF EXISTS "Team members can view shared project captions" ON public.captions;
CREATE POLICY "Team members can view shared project captions" ON public.captions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = captions.project_id AND p.team_id IS NOT NULL AND public.is_team_member(p.team_id, auth.uid())));

DROP POLICY IF EXISTS "Managers see invitations" ON public.team_invitations;
CREATE POLICY "Managers see invitations" ON public.team_invitations
FOR SELECT TO authenticated
USING (public.can_manage_team(team_id, auth.uid()));

DROP POLICY IF EXISTS "Users manage own usage alerts" ON public.usage_alerts;
CREATE POLICY "Users manage own usage alerts" ON public.usage_alerts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);