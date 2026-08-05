
CREATE OR REPLACE FUNCTION public.record_error_log(
  _fingerprint text,
  _severity public.error_severity,
  _source public.error_source,
  _message text,
  _stack text,
  _url text,
  _user_agent text,
  _release text,
  _function_name text,
  _user_id uuid,
  _context jsonb
)
RETURNS TABLE(
  id uuid,
  occurrence_count integer,
  is_new boolean,
  severity public.error_severity,
  alerted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.error_logs%rowtype;
  v_id uuid;
  v_count integer;
  v_is_new boolean;
  v_severity public.error_severity;
  v_alerted_at timestamptz;
BEGIN
  SELECT * INTO v_existing FROM public.error_logs WHERE fingerprint = _fingerprint;
  IF FOUND THEN
    UPDATE public.error_logs AS el
       SET occurrence_count = el.occurrence_count + 1,
           last_seen_at = now(),
           message = _message,
           stack = COALESCE(_stack, el.stack),
           url = COALESCE(_url, el.url),
           user_agent = COALESCE(_user_agent, el.user_agent),
           context = _context,
           resolved = false,
           resolved_at = NULL
     WHERE el.id = v_existing.id
     RETURNING el.id, el.occurrence_count, false, el.severity, el.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  ELSE
    INSERT INTO public.error_logs (fingerprint, severity, source, message, stack, url, user_agent, release, function_name, user_id, context)
    VALUES (_fingerprint, _severity, _source, _message, _stack, _url, _user_agent, _release, _function_name, _user_id, _context)
    RETURNING public.error_logs.id, public.error_logs.occurrence_count, true, public.error_logs.severity, public.error_logs.alerted_at
        INTO v_id, v_count, v_is_new, v_severity, v_alerted_at;
  END IF;

  id := v_id;
  occurrence_count := v_count;
  is_new := v_is_new;
  severity := v_severity;
  alerted_at := v_alerted_at;
  RETURN NEXT;
END;
$function$;
