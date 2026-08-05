
CREATE TYPE public.error_severity AS ENUM ('info','warning','error','critical');
CREATE TYPE public.error_source AS ENUM ('frontend','edge_function','database','external');

CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  severity public.error_severity NOT NULL DEFAULT 'error',
  source public.error_source NOT NULL DEFAULT 'frontend',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  release TEXT,
  function_name TEXT,
  user_id UUID,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX error_logs_fingerprint_idx ON public.error_logs (fingerprint);
CREATE INDEX error_logs_last_seen_idx ON public.error_logs (last_seen_at DESC);
CREATE INDEX error_logs_severity_idx ON public.error_logs (severity);
CREATE INDEX error_logs_resolved_idx ON public.error_logs (resolved);

GRANT SELECT, UPDATE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update error logs"
ON public.error_logs FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Upsert function used by the log-error edge function
CREATE OR REPLACE FUNCTION public.record_error_log(
  _fingerprint TEXT,
  _severity public.error_severity,
  _source public.error_source,
  _message TEXT,
  _stack TEXT,
  _url TEXT,
  _user_agent TEXT,
  _release TEXT,
  _function_name TEXT,
  _user_id UUID,
  _context JSONB
) RETURNS TABLE(id UUID, occurrence_count INTEGER, is_new BOOLEAN, severity public.error_severity, alerted_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.error_logs%rowtype;
BEGIN
  SELECT * INTO v_existing FROM public.error_logs WHERE fingerprint = _fingerprint;
  IF FOUND THEN
    UPDATE public.error_logs
       SET occurrence_count = occurrence_count + 1,
           last_seen_at = now(),
           message = _message,
           stack = COALESCE(_stack, stack),
           url = COALESCE(_url, url),
           user_agent = COALESCE(_user_agent, user_agent),
           context = _context,
           resolved = false,
           resolved_at = NULL
     WHERE id = v_existing.id
     RETURNING public.error_logs.id, public.error_logs.occurrence_count, false, public.error_logs.severity, public.error_logs.alerted_at
        INTO id, occurrence_count, is_new, severity, alerted_at;
    RETURN NEXT;
  ELSE
    INSERT INTO public.error_logs (fingerprint, severity, source, message, stack, url, user_agent, release, function_name, user_id, context)
    VALUES (_fingerprint, _severity, _source, _message, _stack, _url, _user_agent, _release, _function_name, _user_id, _context)
    RETURNING public.error_logs.id, public.error_logs.occurrence_count, true, public.error_logs.severity, public.error_logs.alerted_at
        INTO id, occurrence_count, is_new, severity, alerted_at;
    RETURN NEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_error_alerted(_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.error_logs SET alerted_at = now() WHERE id = _id;
$$;
