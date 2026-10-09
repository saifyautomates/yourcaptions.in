
-- =====================================================================
-- 1. Extensions required for scheduled jobs
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================================
-- 2. templates — reusable caption style presets
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  preview_url  text,
  style        jsonb NOT NULL,
  category     text,
  is_system    boolean NOT NULL DEFAULT false,
  is_public    boolean NOT NULL DEFAULT false,
  owner_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_owner_idx    ON public.templates(owner_id);
CREATE INDEX IF NOT EXISTS templates_category_idx ON public.templates(category);
CREATE INDEX IF NOT EXISTS templates_system_idx   ON public.templates(is_system) WHERE is_system;

GRANT SELECT                          ON public.templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.templates TO authenticated;
GRANT ALL                             ON public.templates TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_read_visible"
  ON public.templates FOR SELECT
  USING (
    is_system
    OR is_public
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "templates_owner_insert"
  ON public.templates FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND is_system = false                        -- only admins create system templates
  );

CREATE POLICY "templates_owner_update"
  ON public.templates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (owner_id = auth.uid() AND is_system = false)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "templates_owner_delete"
  ON public.templates FOR DELETE TO authenticated
  USING (
    (owner_id = auth.uid() AND is_system = false)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER templates_set_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 3. plan_limits — reference config for the three plans
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan               public.plan_tier PRIMARY KEY,
  monthly_credits    numeric NOT NULL,
  max_video_minutes  numeric NOT NULL,
  max_projects       integer NOT NULL,
  max_team_members   integer NOT NULL,
  can_export_srt     boolean NOT NULL DEFAULT true,
  can_burn_captions  boolean NOT NULL DEFAULT false,
  can_dub            boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT                          ON public.plan_limits TO anon, authenticated;
GRANT ALL                             ON public.plan_limits TO service_role;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_limits_public_read" ON public.plan_limits;
CREATE POLICY "plan_limits_public_read"
  ON public.plan_limits FOR SELECT USING (true);

DROP POLICY IF EXISTS "plan_limits_admin_write" ON public.plan_limits;
CREATE POLICY "plan_limits_admin_write"
  ON public.plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS monthly_credits numeric DEFAULT 30;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS max_video_minutes numeric DEFAULT 10;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS max_projects integer DEFAULT 3;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS max_team_members integer DEFAULT 1;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS can_export_srt boolean DEFAULT true;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS can_burn_captions boolean DEFAULT false;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS can_dub boolean DEFAULT false;

INSERT INTO public.plan_limits
  (plan, monthly_credits, max_video_minutes, max_projects, max_team_members,
   can_export_srt, can_burn_captions, can_dub)
VALUES
  ('starter',   30,  10,   3,  1,  true, false, false),
  ('creator',  300,  60, 100, 10,  true, true,  false),
  ('studio',  1000, 180, 999, 50,  true, true,  true)
ON CONFLICT (plan) DO UPDATE
  SET monthly_credits   = EXCLUDED.monthly_credits,
      max_video_minutes = EXCLUDED.max_video_minutes,
      max_projects      = EXCLUDED.max_projects,
      max_team_members  = EXCLUDED.max_team_members,
      can_export_srt    = EXCLUDED.can_export_srt,
      can_burn_captions = EXCLUDED.can_burn_captions,
      can_dub           = EXCLUDED.can_dub,
      updated_at        = now();

-- =====================================================================
-- 4. Monthly credit reset RPC (called by cron)
--    For every user whose plan is still valid (or has no expiry), overwrite
--    plan_credits with plan_limits.monthly_credits and log a plan_grant
--    ledger row. topup_credits are untouched.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reset_plan_credits_for_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_count    integer := 0;
  v_new_bal  numeric;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, pl.monthly_credits, pl.plan
      FROM public.profiles p
      JOIN public.plan_limits pl ON pl.plan = p.plan
     WHERE p.plan_expires_at IS NULL OR p.plan_expires_at > now()
  LOOP
    INSERT INTO public.credit_wallets(user_id) VALUES (r.user_id)
      ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.credit_wallets
       SET plan_credits          = r.monthly_credits,
           plan_credits_reset_at = now(),
           updated_at            = now()
     WHERE user_id = r.user_id
    RETURNING plan_credits + topup_credits INTO v_new_bal;

    INSERT INTO public.credit_transactions
      (user_id, type, amount, balance_after, status, metadata)
    VALUES
      (r.user_id, 'plan_grant', r.monthly_credits, v_new_bal, 'completed',
       jsonb_build_object('bucket','plan','source','monthly_reset','plan',r.plan));

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_plan_credits_for_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_plan_credits_for_all() TO service_role;

-- =====================================================================
-- 5. Stale-processing cleanup RPC (called by cron)
--    Marks any project stuck in 'processing' for > 30 minutes as 'error'
--    and refunds any credit reservations that reference it.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_processing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_count  integer := 0;
BEGIN
  FOR r IN
    SELECT id
      FROM public.projects
     WHERE status = 'processing'
       AND updated_at < now() - interval '30 minutes'
  LOOP
    UPDATE public.projects
       SET status = 'error', updated_at = now()
     WHERE id = r.id;

    -- Refund any reservations still open for this project
    PERFORM public.refund_reservation(t.id, 'stale_processing_timeout')
       FROM public.credit_transactions t
      WHERE t.reference_id   = r.id
        AND t.reference_type IN ('project','transcribe','dub','export')
        AND t.status         = 'reserved';

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_stale_processing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_processing() TO service_role;

-- =====================================================================
-- 6. Schedule the cron jobs (idempotent — unschedule any prior)
-- =====================================================================
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid, jobname FROM cron.job
     WHERE jobname IN ('monthly-credit-reset','cleanup-stale-jobs')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'monthly-credit-reset',
  '0 0 1 * *',
  $$ SELECT public.reset_plan_credits_for_all(); $$
);

SELECT cron.schedule(
  'cleanup-stale-jobs',
  '*/15 * * * *',
  $$ SELECT public.cleanup_stale_processing(); $$
);
