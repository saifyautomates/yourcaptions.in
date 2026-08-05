-- MASTER SPEC DATABASE ADDITIONS

-- 1. ACCOUNT CREDITS (Currency-based for failed ₹5/min processing)
ALTER TABLE public.credit_wallets 
ADD COLUMN IF NOT EXISTS account_credit_balance numeric NOT NULL DEFAULT 0;

-- 2. BRAND KITS & SPEAKER PRESETS
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  logo_url text,
  custom_text text,
  placement text NOT NULL DEFAULT 'top-right',
  size_percent numeric NOT NULL DEFAULT 100,
  opacity numeric NOT NULL DEFAULT 1.0,
  animations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.speaker_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  position text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. PROJECT RETENTION
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 4. ADMIN SECURITY (Secret Challenge & Trusted Devices)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS secret_attempts integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_locked_until timestamptz;

CREATE TABLE IF NOT EXISTS public.admin_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS & GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand kits" ON public.brand_kits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaker_presets TO authenticated;
GRANT ALL ON public.speaker_presets TO service_role;
ALTER TABLE public.speaker_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own speaker presets" ON public.speaker_presets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_trusted_devices TO authenticated;
GRANT ALL ON public.admin_trusted_devices TO service_role;
ALTER TABLE public.admin_trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own trusted devices" ON public.admin_trusted_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
