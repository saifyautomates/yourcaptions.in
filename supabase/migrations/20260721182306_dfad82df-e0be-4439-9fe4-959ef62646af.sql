
CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('text','template','transition','ai_voice','audio')),
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX library_items_category_idx ON public.library_items(category, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT SELECT ON public.library_items TO anon;
GRANT ALL ON public.library_items TO service_role;

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_items readable by everyone (active)"
  ON public.library_items FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin insert"
  ON public.library_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin update"
  ON public.library_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_items admin delete"
  ON public.library_items FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_items_set_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
