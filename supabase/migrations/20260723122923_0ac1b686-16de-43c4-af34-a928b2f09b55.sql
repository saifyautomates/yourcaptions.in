
CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.feedback_submissions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.feedback_submissions TO authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(message) BETWEEN 1 AND 2000
    AND (name IS NULL OR length(name) <= 100)
    AND (email IS NULL OR length(email) <= 255)
  );

CREATE POLICY "Admins can view feedback"
  ON public.feedback_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback"
  ON public.feedback_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback"
  ON public.feedback_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_feedback_submissions_created_at ON public.feedback_submissions (created_at DESC);
