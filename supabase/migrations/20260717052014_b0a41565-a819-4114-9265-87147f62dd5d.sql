-- Persistent background job queue for long-running work (transcribe, dub, ...).
-- Progress is written to `progress` (0-100) + `message`, and the client
-- subscribes via Realtime for resumable UX after reconnect.

CREATE TYPE public.job_kind AS ENUM ('transcribe', 'dub', 'translate');
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

CREATE TABLE public.jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind        public.job_kind NOT NULL,
  status      public.job_status NOT NULL DEFAULT 'queued',
  progress    smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  message     text,
  input       jsonb NOT NULL DEFAULT '{}'::jsonb,
  result      jsonb,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_user_active_idx
  ON public.jobs (user_id, created_at DESC)
  WHERE status IN ('queued', 'running');
CREATE INDEX jobs_project_idx ON public.jobs (project_id, created_at DESC);

GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL    ON public.jobs TO service_role;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs. Inserts/updates are done by edge
-- functions using service_role, so no INSERT/UPDATE policies are needed.
CREATE POLICY "Users view own jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Realtime so clients can resume subscriptions after reconnect.
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;