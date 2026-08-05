-- Create missing storage buckets

INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-media', 'hero-media', true)
ON CONFLICT (id) DO NOTHING;
