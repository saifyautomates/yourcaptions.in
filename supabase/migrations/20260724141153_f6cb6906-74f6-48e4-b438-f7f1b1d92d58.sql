
-- Add WITH CHECK to the projects update policy so an editor cannot silently
-- reassign ownership (user_id / team_id) by passing the USING predicate alone.
DROP POLICY IF EXISTS "Owner or team editor updates project" ON public.projects;

CREATE POLICY "Owner or team editor updates project"
ON public.projects
FOR UPDATE
USING (
  (user_id = auth.uid())
  OR (team_id IS NOT NULL AND team_role_of(team_id, auth.uid()) = ANY (ARRAY['owner'::team_role, 'admin'::team_role, 'editor'::team_role]))
)
WITH CHECK (
  (user_id = auth.uid())
  OR (team_id IS NOT NULL AND team_role_of(team_id, auth.uid()) = ANY (ARRAY['owner'::team_role, 'admin'::team_role, 'editor'::team_role]))
);

-- Defense in depth: block reassignment of user_id or team_id by anyone other
-- than the current owner or an admin. Team editors can edit content but never
-- transfer ownership.
CREATE OR REPLACE FUNCTION public.projects_guard_ownership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    IF auth.uid() IS NULL
       OR (auth.uid() <> OLD.user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'not authorized to reassign project ownership'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_guard_ownership_change ON public.projects;
CREATE TRIGGER projects_guard_ownership_change
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.projects_guard_ownership_change();
