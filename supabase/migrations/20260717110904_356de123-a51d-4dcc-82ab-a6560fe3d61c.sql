CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind public.meter_kind NOT NULL,
  threshold_pct INT NOT NULL DEFAULT 80 CHECK (threshold_pct BETWEEN 1 AND 99),
  in_app_on BOOLEAN NOT NULL DEFAULT true,
  email_on BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_period DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_alerts TO authenticated;
GRANT ALL ON public.usage_alerts TO service_role;

ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own usage alerts"
  ON public.usage_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER usage_alerts_set_updated_at
  BEFORE UPDATE ON public.usage_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_alerts;
ALTER TABLE public.usage_alerts REPLICA IDENTITY FULL;