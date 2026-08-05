
CREATE TYPE public.security_finding_status AS ENUM ('open','accepted','fixed');
CREATE TYPE public.security_finding_severity AS ENUM ('info','low','medium','high','critical');

CREATE TABLE public.security_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_name TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity public.security_finding_severity NOT NULL DEFAULT 'medium',
  status public.security_finding_status NOT NULL DEFAULT 'open',
  resource TEXT,
  notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX security_findings_scanner_ext_uniq ON public.security_findings(scanner_name, external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_findings TO authenticated;
GRANT ALL ON public.security_findings TO service_role;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security findings" ON public.security_findings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can insert security findings" ON public.security_findings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update security findings" ON public.security_findings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete security findings" ON public.security_findings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_security_findings_updated
  BEFORE UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
