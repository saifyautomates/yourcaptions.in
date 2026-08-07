-- ADD PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log(created_at);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs(created_at);

-- ADD AUDIT LOGS FOR ADMIN
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS & GRANTS
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
