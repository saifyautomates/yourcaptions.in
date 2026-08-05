CREATE TYPE public.plan_tier_new AS ENUM ('editor', 'creator', 'studio');

CREATE TABLE IF NOT EXISTS public.simplified_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    current_plan public.plan_tier_new NOT NULL DEFAULT 'editor',
    credits INTEGER NOT NULL DEFAULT 1800,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simplified_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.simplified_users(id) ON DELETE CASCADE,
    video_url TEXT,
    srt_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
