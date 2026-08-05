ALTER TABLE public.captions ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS compare_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS chosen_provider text;