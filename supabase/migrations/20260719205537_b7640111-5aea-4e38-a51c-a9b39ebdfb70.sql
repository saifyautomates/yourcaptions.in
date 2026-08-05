
CREATE TABLE public.hero_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL UNIQUE,
  source_lang text,
  source_text text NOT NULL,
  words jsonb NOT NULL,
  duration double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_transcripts TO anon, authenticated;
GRANT ALL ON public.hero_transcripts TO service_role;
ALTER TABLE public.hero_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_transcripts public read" ON public.hero_transcripts FOR SELECT USING (true);

CREATE TABLE public.hero_transcript_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  lang text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_url, lang)
);
GRANT SELECT ON public.hero_transcript_translations TO anon, authenticated;
GRANT ALL ON public.hero_transcript_translations TO service_role;
ALTER TABLE public.hero_transcript_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_translations public read" ON public.hero_transcript_translations FOR SELECT USING (true);
