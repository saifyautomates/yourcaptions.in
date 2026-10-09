-- ============================================
-- CREDIT RATES (admin editable)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_rates (
  feature          text PRIMARY KEY,
  credits_per_unit numeric NOT NULL,
  unit             text NOT NULL DEFAULT 'minute',
  description      text,
  updated_at       timestamptz DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

ALTER TABLE credit_rates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE credit_rates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
ALTER TABLE credit_rates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Seed default rates
INSERT INTO credit_rates (feature, credits_per_unit, unit, description) VALUES
  ('transcription',      1,  'minute', '1 credit per minute of video transcribed'),
  ('caption_burn',       2,  'minute', '2 credits per minute for burning captions'),
  ('ai_dubbing',         5,  'minute', '5 credits per minute for AI dubbing'),
  ('tts',                2,  'minute', '2 credits per minute of TTS output'),
  ('voice_clone',        3,  'minute', '3 credits per minute of cloned voice'),
  ('audio_enhancement',  1,  'minute', '1 credit per minute of audio'),
  ('lip_sync',           10, 'video',  '10 credits flat per lip sync video'),
  ('avatar_generation',  5,  'image',  '5 credits flat per avatar image'),
  ('video_generation',   20, 'video',  '20 credits flat per generated video'),
  ('background_removal', 2,  'image',  '2 credits flat per image'),
  ('translation',        1,  'minute', '1 credit per minute of transcript translated')
ON CONFLICT (feature) DO NOTHING;

-- ============================================
-- PLAN LIMITS (admin editable)
-- ============================================
CREATE TABLE IF NOT EXISTS plan_limits (
  plan                  text PRIMARY KEY,
  display_name          text NOT NULL,
  monthly_credits       integer NOT NULL,
  max_video_minutes     integer NOT NULL,
  max_file_size_mb      integer NOT NULL,
  storage_gb            integer NOT NULL,
  max_team_members      integer NOT NULL DEFAULT 1,
  can_burn_captions     boolean NOT NULL DEFAULT false,
  can_dub               boolean NOT NULL DEFAULT false,
  can_clone_voice       boolean NOT NULL DEFAULT false,
  can_lip_sync          boolean NOT NULL DEFAULT false,
  can_generate_video    boolean NOT NULL DEFAULT false,
  can_use_api           boolean NOT NULL DEFAULT false,
  can_audio_only_upload boolean NOT NULL DEFAULT false,
  can_green_screen      boolean NOT NULL DEFAULT false,
  can_upload_custom_font boolean NOT NULL DEFAULT false,
  max_export_resolution text NOT NULL DEFAULT '720p',
  max_export_fps        integer NOT NULL DEFAULT 30,
  watermark_forced      boolean NOT NULL DEFAULT true,
  priority_render       boolean NOT NULL DEFAULT false,
  updated_at            timestamptz DEFAULT now(),
  updated_by            uuid REFERENCES auth.users(id)
);

ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS monthly_credits integer DEFAULT 60;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_video_minutes integer DEFAULT 2;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_file_size_mb integer DEFAULT 500;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS storage_gb integer DEFAULT 5;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_team_members integer DEFAULT 1;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_burn_captions boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_dub boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_clone_voice boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_lip_sync boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_generate_video boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_use_api boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_audio_only_upload boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_green_screen boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS can_upload_custom_font boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_export_resolution text DEFAULT '720p';
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS max_export_fps integer DEFAULT 30;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS watermark_forced boolean DEFAULT true;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS priority_render boolean DEFAULT false;
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

INSERT INTO plan_limits (plan, display_name, monthly_credits, max_video_minutes, max_file_size_mb, storage_gb, max_team_members, can_burn_captions, can_dub, can_clone_voice, can_lip_sync, can_generate_video, can_use_api, can_audio_only_upload, can_green_screen, can_upload_custom_font, max_export_resolution, max_export_fps, watermark_forced, priority_render) VALUES
  ('free',    'Free',    60,   2,   500,    5,   1,  false, false, false, false, false, false, false, false, false, '720p',  30, true,  false),
  ('editor',  'Editor',  300,  10,  2000,   20,  1,  true,  false, false, false, false, false, false, false, true,  '1080p', 30, false, false),
  ('creator', 'Creator', 1000, 30,  10000,  60,  3,  true,  true,  true,  true,  false, false, true,  true,  true,  '4k',    60, false, false),
  ('studio',  'Studio',  5000, 999, 999999, 150, 999,true,  true,  true,  true,  true,  true,  true,  true,  true,  '4k',    60, false, true)
ON CONFLICT (plan) DO NOTHING;

-- ============================================
-- PLAN PRICING (admin editable)
-- ============================================
-- PLAN PRICING (admin editable)
-- ============================================
CREATE TABLE IF NOT EXISTS plan_pricing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan                text NOT NULL REFERENCES plan_limits(plan),
  currency            text NOT NULL, -- 'INR' or 'USD'
  monthly_price       numeric NOT NULL,
  yearly_price        numeric NOT NULL, -- per month when billed yearly
  yearly_total        numeric NOT NULL, -- total yearly charge
  original_monthly    numeric,          -- strikethrough price
  original_yearly     numeric,          -- strikethrough yearly
  razorpay_plan_id_monthly text,
  razorpay_plan_id_yearly  text,
  stripe_price_id_monthly  text,
  stripe_price_id_yearly   text,
  is_active           boolean DEFAULT true,
  updated_at          timestamptz DEFAULT now(),
  updated_by          uuid REFERENCES auth.users(id),
  UNIQUE(plan, currency)
);

INSERT INTO plan_pricing (plan, currency, monthly_price, yearly_price, yearly_total, original_monthly, original_yearly) VALUES
  ('editor',  'INR', 499,  416,  4992,  670,  558),
  ('creator', 'INR', 999,  833,  9996,  1250, 1042),
  ('studio',  'INR', 2599, 2166, 25992, 3400, 2833),
  ('editor',  'USD', 6,    5,    60,    8,    7),
  ('creator', 'USD', 12,   10,   120,   15,   12),
  ('studio',  'USD', 30,   25,   300,   40,   33)
ON CONFLICT (plan, currency) DO NOTHING;

-- ============================================
-- FEATURE FLAGS (admin editable)
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
  feature_name         text PRIMARY KEY,
  display_name         text NOT NULL,
  description          text,
  enabled_global       boolean NOT NULL DEFAULT true,
  enabled_plans        text[] DEFAULT '{}', -- empty = all plans
  is_beta              boolean DEFAULT false,
  updated_at           timestamptz DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id)
);

INSERT INTO feature_flags (feature_name, display_name, description, enabled_global, enabled_plans) VALUES
  ('transcription',      'Transcription',        'AI video transcription',          true, '{}'),
  ('caption_editor',     'Caption Editor',       'Visual caption editor',           true, '{}'),
  ('ai_dubbing',         'AI Dubbing',           'Dub video in any language',       true, '{creator,studio}'),
  ('voice_cloning',      'Voice Cloning',        'Clone voice from sample',         true, '{creator,studio}'),
  ('lip_sync',           'Lip Sync Avatar',      'Talking head generation',         true, '{creator,studio}'),
  ('video_generation',   'Video Generation',     'AI video generation',             true, '{studio}'),
  ('avatar_generation',  'Avatar Generation',    'AI avatar image generation',      true, '{creator,studio}'),
  ('background_removal', 'Background Removal',   'Remove image background',         true, '{}'),
  ('audio_enhancement',  'Audio Enhancement',    'Denoise and enhance audio',       true, '{}'),
  ('translation',        'Caption Translation',  'Translate captions to any lang',  true, '{}'),
  ('team_collab',        'Team Collaboration',   'Invite team members',             true, '{creator,studio}'),
  ('api_access',         'API Access',           'REST API for developers',         true, '{studio}'),
  ('green_screen',       'Green Screen',         'Chroma key export',               true, '{creator,studio}'),
  ('srt_export',         'SRT Export',           'Export SRT subtitle files',       true, '{}'),
  ('tts',                'Text to Speech',       'AI text to speech',               true, '{editor,creator,studio}')
ON CONFLICT (feature_name) DO NOTHING;

-- ============================================
-- SYSTEM SETTINGS (admin editable)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  key          text PRIMARY KEY,
  value        jsonb NOT NULL,
  description  text,
  updated_at   timestamptz DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id)
);

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS setting_key text;

DO $$
BEGIN
  UPDATE system_settings SET key = setting_key WHERE key IS NULL AND setting_key IS NOT NULL;
  UPDATE system_settings SET setting_key = key WHERE setting_key IS NULL AND key IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

INSERT INTO system_settings (key, setting_key, value, description)
SELECT s.k, s.k, s.v::jsonb, s.d
FROM (VALUES
  ('maintenance_mode',      'false',                       'Show maintenance page to all users'),
  ('announcement_bar',      '{"enabled": false, "text": "", "type": "info", "link": "", "link_text": ""}', 'Top banner shown on all pages'),
  ('max_upload_size_mb',    '500',                         'Maximum file upload size in MB'),
  ('watermark_text',        '"Yourcaptions.in"',          'Watermark text on free plan exports'),
  ('free_trial_credits',    '60',                          'Credits given on signup'),
  ('referral_credits',      '50',                          'Credits given for referral'),
  ('support_email',         '"support@Yourcaptions.in"',  'Support contact email'),
  ('min_app_version',       '"1.0.0"',                     'Minimum required app version')
) AS s(k, v, d)
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings 
  WHERE key = s.k OR setting_key = s.k
);

-- ============================================
-- ADMIN AUDIT LOG (every admin action logged)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id),
  admin_email  text NOT NULL,
  action       text NOT NULL,
  target_type  text, -- 'user', 'setting', 'credit_rate', 'plan', 'feature_flag'
  target_id    text,
  old_value    jsonb,
  new_value    jsonb,
  ip_address   text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- credit_rates: public read, admin write only
ALTER TABLE credit_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_rates_read" ON credit_rates;
CREATE POLICY "credit_rates_read" ON credit_rates FOR SELECT USING (true);
DROP POLICY IF EXISTS "credit_rates_admin" ON credit_rates;
CREATE POLICY "credit_rates_admin" ON credit_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- plan_limits: public read, admin write only
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_limits_read" ON plan_limits;
CREATE POLICY "plan_limits_read" ON plan_limits FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_limits_admin" ON plan_limits;
CREATE POLICY "plan_limits_admin" ON plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- plan_pricing: public read, admin write only
ALTER TABLE plan_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_pricing_read" ON plan_pricing;
CREATE POLICY "plan_pricing_read" ON plan_pricing FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_pricing_admin" ON plan_pricing;
CREATE POLICY "plan_pricing_admin" ON plan_pricing FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- feature_flags: public read, admin write only
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature_flags_read" ON feature_flags;
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS "feature_flags_admin" ON feature_flags;
CREATE POLICY "feature_flags_admin" ON feature_flags FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- system_settings: public read, admin write only
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_settings_read" ON system_settings;
CREATE POLICY "system_settings_read" ON system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "system_settings_admin" ON system_settings;
CREATE POLICY "system_settings_admin" ON system_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_audit_log: admin read only
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_admin" ON admin_audit_log;
CREATE POLICY "audit_log_admin" ON admin_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGER: Update updated_at on all admin tables
-- ============================================
CREATE OR REPLACE FUNCTION update_admin_table_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION update_admin_table_timestamp FROM PUBLIC;

DROP TRIGGER IF EXISTS credit_rates_timestamp ON credit_rates;
CREATE TRIGGER credit_rates_timestamp BEFORE UPDATE ON credit_rates FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();

DROP TRIGGER IF EXISTS plan_limits_timestamp ON plan_limits;
CREATE TRIGGER plan_limits_timestamp BEFORE UPDATE ON plan_limits FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();

DROP TRIGGER IF EXISTS plan_pricing_timestamp ON plan_pricing;
CREATE TRIGGER plan_pricing_timestamp BEFORE UPDATE ON plan_pricing FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();

DROP TRIGGER IF EXISTS feature_flags_timestamp ON feature_flags;
CREATE TRIGGER feature_flags_timestamp BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();

DROP TRIGGER IF EXISTS system_settings_timestamp ON system_settings;
CREATE TRIGGER system_settings_timestamp BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_admin_table_timestamp();
