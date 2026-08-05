
CREATE TABLE public.hero_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  storage_path text,
  label text,
  orientation text NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait','landscape')),
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hero_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_media TO authenticated;
GRANT ALL ON public.hero_media TO service_role;

ALTER TABLE public.hero_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_media public read" ON public.hero_media FOR SELECT USING (true);
CREATE POLICY "hero_media admin insert" ON public.hero_media FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hero_media admin update" ON public.hero_media FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "hero_media admin delete" ON public.hero_media FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Ensure only one active per orientation
CREATE OR REPLACE FUNCTION public.hero_media_single_active()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.hero_media SET is_active = false
      WHERE orientation = NEW.orientation AND id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hero_media_single_active_trg
AFTER INSERT OR UPDATE OF is_active ON public.hero_media
FOR EACH ROW WHEN (NEW.is_active) EXECUTE FUNCTION public.hero_media_single_active();
