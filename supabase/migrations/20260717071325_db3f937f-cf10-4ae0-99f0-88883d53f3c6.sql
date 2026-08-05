
-- Category enum
DO $$ BEGIN
  CREATE TYPE public.asset_category AS ENUM ('font','image','audio','video','logo','preset');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category public.asset_category NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assets TO authenticated;
GRANT ALL ON public.user_assets TO service_role;

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assets"
  ON public.user_assets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_assets_user_created_idx ON public.user_assets(user_id, created_at DESC);
CREATE INDEX user_assets_user_category_idx ON public.user_assets(user_id, category);

CREATE TRIGGER user_assets_set_updated_at
  BEFORE UPDATE ON public.user_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for `assets` bucket (mirror `media` bucket pattern)
CREATE POLICY "Users read own assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assets' AND (storage.foldername(name))[1] = auth.uid()::text);
